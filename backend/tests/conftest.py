"""Shared fixtures for backend tests. Each test gets an isolated SQLite DB."""

from __future__ import annotations

import pytest

from app.models import EventEnvelope
from app.store import Store


@pytest.fixture()
def store(tmp_path):
    from app.db import init_db

    conn = init_db(tmp_path / "test.db")
    st = Store(conn)
    yield st
    conn.close()


@pytest.fixture()
def client(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setenv("IK_DB_PATH", str(tmp_path / "api.db"))
    with TestClient(app) as c:
        yield c


# ── helpers ─────────────────────────────────────────────────────────────────

def make_study(store: Store, study_id: str = "demo", conditions=None,
               expected=None):
    return store.create_study(
        study_id=study_id,
        title="Demo Study",
        conditions=conditions or ["v1", "v2"],
        expected_event_types=expected or [
            "session_start",
            "demographics",
            "decision",
            "tsi_response",
            "session_complete",
        ],
    )


def make_session(store: Store, study_id: str = "demo", participant_id: str = "P001",
                 condition: str = "v1"):
    return store.create_session(
        study_id=study_id, participant_id=participant_id, condition=condition
    )


def envelope(session: dict, seq: int, event_type: str = "decision",
             payload=None, **over):
    """Build an EventEnvelope referencing an existing session."""
    defaults = dict(
        event_id=f"evt-{seq}",
        study_id=session["study_id"],
        participant_id=session["participant_id"],
        session_id=session["session_id"],
        event_type=event_type,
        schema_version=1,
        sequence_number=seq,
        client_timestamp="2026-08-01T00:00:00+00:00",
        condition=session["condition"],
        payload=payload if payload is not None else {},
        idempotency_key=f"evt-{seq}",
    )
    defaults.update(over)
    return EventEnvelope(**defaults)


def complete_session(store: Store, *, session=None, n_decisions: int = 2,
                     study_id: str = "demo", participant_id: str = "P001",
                     condition: str = "v1"):
    """Insert a fully valid session: start, demographics, N decisions, tsi, end."""
    if session is None:
        session = make_session(store, study_id, participant_id, condition)
    seq = 0
    for etype, payload in [
        ("session_start", {}),
        ("demographics", {"age": "25-34", "gender": "female", "aiFamiliarity": 3}),
    ]:
        store.ingest(envelope(session, seq, etype, payload))
        seq += 1
    for i in range(n_decisions):
        store.ingest(envelope(
            session, seq, "decision",
            {"scenarioId": f"sc-{i}", "decision": "trust",
             "probabilityPrediction": 0.8, "decisionTimeMs": 1200},
        ))
        seq += 1
    store.ingest(envelope(session, seq, "tsi_response", {"tsiMean": 4.5}))
    seq += 1
    store.ingest(envelope(session, seq, "session_complete", {}))
    return session
