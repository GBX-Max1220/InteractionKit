"""Ingestion, idempotency, and validation tests."""

from __future__ import annotations

from app.store import (
    IdempotencyConflictError,
    SessionNotFoundError,
    UnsupportedSchemaVersionError,
)

from .conftest import complete_session, envelope, make_session, make_study


def test_valid_ingestion(store):
    make_study(store)
    session = make_session(store)
    status, row, _ = store.ingest(envelope(session, 0, "session_start", {}))
    assert status == "accepted"
    assert row["server_timestamp"]  # server-assigned
    events = store.get_session_events(session["session_id"])
    assert len(events) == 1
    assert events[0]["flags"] == []


def test_duplicate_event_id_is_noop(store):
    make_study(store)
    session = make_session(store)
    ev = envelope(session, 0, "session_start", {})
    store.ingest(ev)
    status, row, _ = store.ingest(ev)
    assert status == "duplicate"
    assert row["event_id"] == ev.event_id
    assert len(store.get_session_events(session["session_id"])) == 1
    s = store.get_session(session["session_id"])
    assert s["accepted_event_count"] == 1
    assert s["duplicate_event_count"] == 1


def test_idempotency_conflict_defined_behavior(store):
    make_study(store)
    session = make_session(store)
    # First event claims idempotency_key "same-key"
    store.ingest(envelope(session, 0, "session_start", {}, idempotency_key="same-key"))
    # Same logical event (same idempotency_key), different event_id → conflict
    ev2 = envelope(session, 1, "session_start", {},
                   event_id="different-id", idempotency_key="same-key")
    try:
        store.ingest(ev2)
        assert False, "expected IdempotencyConflictError"
    except IdempotencyConflictError as exc:
        assert exc.existing_event_id == "evt-0"
    assert len(store.get_session_events(session["session_id"])) == 1


def test_unsupported_schema_version_rejected(store):
    make_study(store)
    session = make_session(store)
    ev = envelope(session, 0, "session_start", {}, schema_version=99)
    try:
        store.ingest(ev)
        assert False, "expected UnsupportedSchemaVersionError"
    except UnsupportedSchemaVersionError:
        pass
    assert len(store.get_session_events(session["session_id"])) == 0


def test_malformed_payload_flagged_not_rejected(store):
    make_study(store)
    session = make_session(store)
    # decision without required payload fields → malformed flag, still stored
    status, row, _ = store.ingest(envelope(session, 0, "decision", {}))
    assert status == "accepted"
    assert "malformed_payload" in row["flags"]


def test_non_object_payload_flagged(store):
    make_study(store)
    session = make_session(store)
    status, row, _ = store.ingest(envelope(session, 0, "decision", "not-an-object"))
    assert status == "accepted"
    assert "malformed_payload" in row["flags"]


def test_invalid_condition_flagged(store):
    make_study(store)
    session = make_session(store)  # condition v1
    status, row, _ = store.ingest(envelope(session, 0, "decision", {},
                                           condition="v9"))
    assert status == "accepted"
    assert "invalid_condition" in row["flags"]


def test_invalid_client_timestamp_flagged(store):
    make_study(store)
    session = make_session(store)
    status, row, _ = store.ingest(
        envelope(session, 0, "session_start", {}, client_timestamp="not-a-date")
    )
    assert status == "accepted"
    assert "invalid_client_timestamp" in row["flags"]


def test_session_participant_mismatch_flagged(store):
    make_study(store)
    session = make_session(store)  # participant P001
    status, row, _ = store.ingest(
        envelope(session, 0, "decision", {}, participant_id="OTHER")
    )
    assert status == "accepted"
    assert "session_participant_mismatch" in row["flags"]


def test_unknown_session_404(store):
    make_study(store)
    try:
        store.ingest(envelope({"session_id": "missing", "study_id": "demo",
                               "participant_id": "P", "condition": "v1"},
                              0, "session_start", {}))
        assert False, "expected SessionNotFoundError"
    except SessionNotFoundError:
        pass


def test_unknown_event_type_flagged(store):
    make_study(store)
    session = make_session(store)
    status, row, _ = store.ingest(envelope(session, 0, "totally_unknown", {}))
    assert status == "accepted"
    assert "unknown_event_type" in row["flags"]


def test_incomplete_session_retained_and_resumable(store):
    make_study(store)
    session = make_session(store)
    store.ingest(envelope(session, 0, "session_start", {}))
    store.ingest(envelope(session, 1, "decision", {
        "scenarioId": "sc-1", "decision": "trust",
        "probabilityPrediction": 0.7, "decisionTimeMs": 800,
    }))
    s = store.get_session(session["session_id"])
    assert s["status"] == "in_progress"
    # later resumption: more events append to the same session
    store.ingest(envelope(session, 2, "decision", {
        "scenarioId": "sc-2", "decision": "distrust",
        "probabilityPrediction": 0.3, "decisionTimeMs": 900,
    }))
    assert len(store.get_session_events(session["session_id"])) == 3


def test_batch_duplicate_is_safe(store):
    make_study(store)
    session = make_session(store)
    evs = [
        envelope(session, i, t, p)
        for i, (t, p) in enumerate([
            ("session_start", {}),
            ("decision", {"scenarioId": "s", "decision": "trust",
                          "probabilityPrediction": 0.5, "decisionTimeMs": 1}),
        ])
    ]
    from app.models import EventEnvelope

    first = store.ingest_batch([EventEnvelope.model_validate(e.model_dump()) for e in evs])
    second = store.ingest_batch([EventEnvelope.model_validate(e.model_dump()) for e in evs])
    assert [o["status"] for o in first] == ["accepted", "accepted"]
    assert [o["status"] for o in second] == ["duplicate", "duplicate"]
    assert len(store.get_session_events(session["session_id"])) == 2


def test_batch_partial_failure_keeps_rest(store):
    make_study(store)
    session = make_session(store)
    from app.models import EventEnvelope

    evs = [
        EventEnvelope.model_validate(e.model_dump())
        for e in [
            envelope(session, 0, "session_start", {}),
            envelope(session, 1, "session_start", {}, schema_version=99),  # rejected
            envelope(session, 2, "session_complete", {}),
        ]
    ]
    outcomes = store.ingest_batch(evs)
    assert [o["status"] for o in outcomes] == ["accepted", "rejected", "accepted"]
    assert len(store.get_session_events(session["session_id"])) == 2


def test_complete_session_status(store):
    make_study(store)
    session = complete_session(store)
    assert store.get_session(session["session_id"])["status"] == "complete"
