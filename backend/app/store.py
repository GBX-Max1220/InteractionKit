"""Append-only event store and session lifecycle.

Events are INSERT-only. Duplicate detection is enforced by two constraints:

* ``event_id`` is the primary key — re-sending the same event_id is a no-op
  (returns the existing row, counted as a duplicate).
* ``UNIQUE (session_id, idempotency_key)`` — re-sending the same logical event
  with a *different* event_id is a conflict (defined behavior, 409).

Session counters (accepted/duplicate/rejected) are materialized state on the
session row, updated at ingestion; they make duplicate/rejection counts
available to the integrity report without scanning history.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from .config import SUPPORTED_SCHEMA_VERSIONS
from .models import EventEnvelope, utcnow_iso
from .validation import (
    FLAG_SESSION_PARTICIPANT_MISMATCH,
    FLAG_SESSION_STUDY_MISMATCH,
    validate_envelope,
)


class StudyNotFoundError(KeyError):
    pass


class SessionNotFoundError(KeyError):
    pass


class UnsupportedSchemaVersionError(ValueError):
    pass


class IdempotencyConflictError(ValueError):
    def __init__(self, event_id: str, existing_event_id: str):
        super().__init__(f"idempotency_key already used by event {existing_event_id}")
        self.event_id = event_id
        self.existing_event_id = existing_event_id


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decode_payloads(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "payload": json.loads(row["payload_json"]),
        "flags": json.loads(row["flags_json"]),
    }


class Store:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    # ── Studies ──────────────────────────────────────────────────────────

    def create_study(
        self,
        *,
        study_id: str,
        title: str,
        description: str = "",
        conditions: list[str] | None = None,
        start_event_type: str = "session_start",
        end_event_type: str = "session_complete",
        expected_event_types: list[str] | None = None,
    ) -> dict[str, Any]:
        cond = conditions or ["v1", "v2"]
        expected = expected_event_types or [
            "session_start",
            "demographics",
            "decision",
            "tsi_response",
            "session_complete",
        ]
        self.conn.execute(
            "INSERT OR REPLACE INTO studies "
            "(study_id, title, description, conditions_json, start_event_type, "
            " end_event_type, expected_event_types_json, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                study_id,
                title,
                description,
                json.dumps(cond),
                start_event_type,
                end_event_type,
                json.dumps(expected),
                _utcnow(),
            ),
        )
        self.conn.commit()
        return self.get_study(study_id)

    def get_study(self, study_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT * FROM studies WHERE study_id = ?", (study_id,)
        ).fetchone()
        if row is None:
            raise StudyNotFoundError(study_id)
        return {
            "study_id": row["study_id"],
            "title": row["title"],
            "description": row["description"],
            "conditions": json.loads(row["conditions_json"]),
            "start_event_type": row["start_event_type"],
            "end_event_type": row["end_event_type"],
            "expected_event_types": json.loads(row["expected_event_types_json"]),
            "created_at": row["created_at"],
        }

    # ── Sessions ─────────────────────────────────────────────────────────

    def create_session(
        self,
        *,
        study_id: str,
        participant_id: str,
        condition: str,
        external_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> dict[str, Any]:
        study = self.get_study(study_id)  # raises if unknown
        if study["conditions"] and condition not in study["conditions"]:
            raise ValueError(
                f"condition {condition!r} not in study conditions {study['conditions']}"
            )
        sid = session_id or uuid4().hex
        now = _utcnow()
        self.conn.execute(
            "INSERT OR IGNORE INTO participants (participant_id, study_id, external_id, created_at) "
            "VALUES (?, ?, ?, ?)",
            (participant_id, study_id, external_id, now),
        )
        self.conn.execute(
            "INSERT INTO sessions "
            "(session_id, study_id, participant_id, condition, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 'in_progress', ?, ?)",
            (sid, study_id, participant_id, condition, now, now),
        )
        self.conn.commit()
        return self.get_session(sid)

    def get_session(self, session_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if row is None:
            raise SessionNotFoundError(session_id)
        return dict(row)

    # ── Event ingestion ──────────────────────────────────────────────────

    def ingest(self, env: EventEnvelope) -> tuple[str, dict[str, Any], Optional[str]]:
        """Ingest one envelope.

        Returns (status, row_or_None, reason) where status is one of
        'accepted' | 'duplicate' | 'rejected'.
        """
        if env.schema_version not in SUPPORTED_SCHEMA_VERSIONS:
            raise UnsupportedSchemaVersionError(
                f"schema_version {env.schema_version} not supported "
                f"(supported: {sorted(SUPPORTED_SCHEMA_VERSIONS)})"
            )

        session = self.get_session(env.session_id)  # 404 if unknown
        study = self.get_study(env.study_id)

        if env.study_id != session["study_id"]:
            raise SessionNotFoundError(env.session_id)

        # event_id idempotency (primary key)
        existing = self.conn.execute(
            "SELECT * FROM events WHERE event_id = ?", (env.event_id,)
        ).fetchone()
        if existing is not None:
            self._bump_counter(session["session_id"], "duplicate")
            row = dict(existing)
            row.update(_decode_payloads(existing))
            return ("duplicate", row, None)

        idem_key = env.idempotency_key or env.event_id
        # idempotency_key conflict (defined behavior): same logical event,
        # different event_id → reject with 409 semantics.
        conflict = self.conn.execute(
            "SELECT event_id FROM events WHERE session_id = ? AND idempotency_key = ?",
            (env.session_id, idem_key),
        ).fetchone()
        if conflict is not None:
            self._bump_counter(session["session_id"], "rejected")
            raise IdempotencyConflictError(env.event_id, conflict["event_id"])

        flags = validate_envelope(
            event_type=env.event_type,
            condition=env.condition,
            client_timestamp=env.client_timestamp,
            payload=env.payload,
            study_conditions=study["conditions"],
        )
        if env.participant_id != session["participant_id"]:
            flags.append(FLAG_SESSION_PARTICIPANT_MISMATCH)
        if env.study_id != session["study_id"]:
            flags.append(FLAG_SESSION_STUDY_MISMATCH)

        now = _utcnow()
        with self.conn:
            self.conn.execute(
                "INSERT INTO events "
                "(event_id, study_id, participant_id, session_id, event_type, "
                " schema_version, sequence_number, client_timestamp, server_timestamp, "
                " condition, payload_json, idempotency_key, flags_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    env.event_id,
                    env.study_id,
                    env.participant_id,
                    env.session_id,
                    env.event_type,
                    env.schema_version,
                    env.sequence_number,
                    env.client_timestamp,
                    now,
                    env.condition,
                    json.dumps(env.payload, ensure_ascii=False),
                    idem_key,
                    json.dumps(flags),
                ),
            )
            self.conn.execute(
                "UPDATE sessions SET updated_at = ?, accepted_event_count = accepted_event_count + 1, "
                "  first_event_at = COALESCE(first_event_at, ?) "
                "WHERE session_id = ?",
                (now, now, env.session_id),
            )
            if env.event_type == study["end_event_type"]:
                self.conn.execute(
                    "UPDATE sessions SET status = 'complete', completed_at = ? "
                    "WHERE session_id = ?",
                    (now, env.session_id),
                )

        row = self._event_row(env.event_id)
        return ("accepted", row, None)

    def ingest_batch(self, envs: list[EventEnvelope]) -> list[dict[str, Any]]:
        """Ingest a batch; a failure in one item never aborts the rest."""
        outcomes = []
        for env in envs:
            try:
                status, row, reason = self.ingest(env)
                outcomes.append(
                    {
                        "status": status,
                        "event_id": env.event_id,
                        "reason": reason,
                        "stored_event_id": row.get("event_id") if row else None,
                    }
                )
            except UnsupportedSchemaVersionError as exc:
                self._bump_counter(env.session_id, "rejected")
                outcomes.append(
                    {"status": "rejected", "event_id": env.event_id, "reason": str(exc)}
                )
            except IdempotencyConflictError as exc:
                outcomes.append(
                    {
                        "status": "rejected",
                        "event_id": env.event_id,
                        "reason": str(exc),
                        "stored_event_id": exc.existing_event_id,
                    }
                )
            except (SessionNotFoundError, StudyNotFoundError) as exc:
                outcomes.append(
                    {"status": "rejected", "event_id": env.event_id, "reason": str(exc)}
                )
        return outcomes

    # ── Reads ────────────────────────────────────────────────────────────

    def _event_row(self, event_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT * FROM events WHERE event_id = ?", (event_id,)
        ).fetchone()
        if row is None:
            raise KeyError(event_id)
        data = dict(row)
        data.update(_decode_payloads(row))
        return data

    def get_session_events(self, session_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT *, rowid AS _rowid FROM events WHERE session_id = ? "
            "ORDER BY sequence_number ASC, server_timestamp ASC",
            (session_id,),
        ).fetchall()
        return [self._decode_event(row) for row in rows]

    def get_study_events(self, study_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT *, rowid AS _rowid FROM events WHERE study_id = ? "
            "ORDER BY session_id ASC, sequence_number ASC, server_timestamp ASC",
            (study_id,),
        ).fetchall()
        return [self._decode_event(row) for row in rows]

    def _decode_event(self, row: sqlite3.Row) -> dict[str, Any]:
        data = {
            "event_id": row["event_id"],
            "study_id": row["study_id"],
            "participant_id": row["participant_id"],
            "session_id": row["session_id"],
            "event_type": row["event_type"],
            "schema_version": row["schema_version"],
            "sequence_number": row["sequence_number"],
            "client_timestamp": row["client_timestamp"],
            "server_timestamp": row["server_timestamp"],
            "condition": row["condition"],
            "idempotency_key": row["idempotency_key"],
            "_rowid": row["_rowid"],
        }
        data.update(_decode_payloads(row))
        return data

    def _bump_counter(self, session_id: str, counter: str) -> None:
        with self.conn:
            self.conn.execute(
                f"UPDATE sessions SET {counter}_event_count = {counter}_event_count + 1 "
                "WHERE session_id = ?",
                (session_id,),
            )
