"""Semantic validation of event envelopes.

Structural failures (missing envelope fields) are rejected by Pydantic before
this module runs. Here we detect *content* problems and produce flags. Flagged
events are still stored — data is preserved and the integrity report surfaces
the problems (the audit philosophy this portfolio already follows).

The one hard rejection mandated by the spec is an unsupported schema version,
handled in store.ingest().
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .config import FUTURE_CLIENT_TS_TOLERANCE_SECONDS

# Required payload fields per known event type (camelCase, matching the
# InteractionKit LogEvent TypeScript type). Unknown types get only an
# 'unknown_event_type' flag and are stored verbatim.
KNOWN_EVENT_SCHEMAS: dict[str, list[str]] = {
    "session_start": [],
    "session_complete": [],
    "demographics": ["age", "gender", "aiFamiliarity"],
    "decision": ["decision", "probabilityPrediction", "scenarioId", "decisionTimeMs"],
    "confidence": ["probabilityPrediction", "scenarioId"],
    "evidence_open": ["scenarioId"],
    "decision_revision": ["initialDecision", "finalDecision", "scenarioId"],
    "outcome": ["scenarioId", "answerAccurate"],
    "familiarity": ["familiarity", "scenarioId"],
    "tsi_response": ["tsiMean"],
}

FLAG_INVALID_CONDITION = "invalid_condition"
FLAG_INVALID_CLIENT_TS = "invalid_client_timestamp"
FLAG_FUTURE_CLIENT_TS = "future_client_timestamp"
FLAG_MALFORMED_PAYLOAD = "malformed_payload"
FLAG_UNKNOWN_EVENT_TYPE = "unknown_event_type"
FLAG_SESSION_PARTICIPANT_MISMATCH = "session_participant_mismatch"
FLAG_SESSION_STUDY_MISMATCH = "session_study_mismatch"


def validate_timestamp(raw: str) -> list[str]:
    """Return timestamp-related flags for a client_timestamp string."""
    flags: list[str] = []
    try:
        parsed = datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return [FLAG_INVALID_CLIENT_TS]
    if parsed.tzinfo is not None:
        now = datetime.now(timezone.utc)
        parsed_utc = parsed.astimezone(timezone.utc)
        if (parsed_utc - now).total_seconds() > FUTURE_CLIENT_TS_TOLERANCE_SECONDS:
            flags.append(FLAG_FUTURE_CLIENT_TS)
    return flags


def validate_payload(event_type: str, payload: Any) -> list[str]:
    """Return payload flags for an event. Non-object payloads are malformed."""
    flags: list[str] = []
    if event_type not in KNOWN_EVENT_SCHEMAS:
        flags.append(FLAG_UNKNOWN_EVENT_TYPE)
        return flags
    if not isinstance(payload, dict):
        flags.append(FLAG_MALFORMED_PAYLOAD)
        return flags
    missing = [f for f in KNOWN_EVENT_SCHEMAS[event_type] if f not in payload]
    if missing:
        flags.append(FLAG_MALFORMED_PAYLOAD)
    return flags


def validate_envelope(
    *,
    event_type: str,
    condition: str,
    client_timestamp: str,
    payload: Any,
    study_conditions: list[str],
) -> list[str]:
    """Produce all semantic flags for one envelope against its study."""
    flags: list[str] = []

    if study_conditions and condition not in study_conditions:
        flags.append(FLAG_INVALID_CONDITION)

    flags.extend(validate_timestamp(client_timestamp))
    flags.extend(validate_payload(event_type, payload))
    return flags
