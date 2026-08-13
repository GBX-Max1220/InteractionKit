"""Integrity engine tests."""

from __future__ import annotations

from app import integrity
from app.store import Store

from .conftest import complete_session, envelope, make_session, make_study


def _report(store: Store, session: dict) -> dict:
    study = store.get_study(session["study_id"])
    events = store.get_session_events(session["session_id"])
    # Re-read the session row so status/counters reflect what was stored.
    view = dict(store.get_session(session["session_id"]))
    view["expected_event_types"] = study["expected_event_types"]
    view["end_event_type"] = study["end_event_type"]
    return integrity.analyze_session(view, events)


def test_clean_complete_session_ok(store):
    make_study(store)
    session = complete_session(store, n_decisions=2)
    report = _report(store, session)
    assert report["status"] == "complete"
    assert report["verdict"] == "ok"
    assert report["event_count"] == 6
    assert report["issues"] == []


def test_incomplete_session_is_warning_not_corrupted(store):
    make_study(store)
    session = make_session(store)
    store.ingest(envelope(session, 0, "session_start", {}))
    report = _report(store, session)
    assert report["status"] == "in_progress"
    assert report["verdict"] == "warning"  # missing end event → warning
    assert any(i["category"] == "missing_expected_events" for i in report["issues"])


def test_sequence_gap_detected(store):
    make_study(store)
    session = make_session(store)
    store.ingest(envelope(session, 0, "session_start", {}))
    store.ingest(envelope(session, 2, "decision", {
        "scenarioId": "s", "decision": "trust",
        "probabilityPrediction": 0.5, "decisionTimeMs": 1,
    }))  # seq 1 missing
    report = _report(store, session)
    gap = [i for i in report["issues"] if i["category"] == "sequence_gaps"]
    assert len(gap) == 1
    assert "1" in gap[0]["detail"]  # the missing sequence


def test_out_of_order_arrival_detected(store):
    make_study(store)
    session = make_session(store)
    # seq 3 arrives before seq 2 (data preserved, anomaly reported)
    store.ingest(envelope(session, 3, "decision", {
        "scenarioId": "s", "decision": "trust",
        "probabilityPrediction": 0.5, "decisionTimeMs": 1,
    }))
    store.ingest(envelope(session, 2, "decision", {
        "scenarioId": "s", "decision": "distrust",
        "probabilityPrediction": 0.4, "decisionTimeMs": 1,
    }))
    report = _report(store, session)
    ooo = [i for i in report["issues"] if i["category"] == "out_of_order"]
    assert len(ooo) == 1
    assert len(ooo[0]["event_ids"]) == 1  # the seq-2 event arrived late
    assert len(store.get_session_events(session["session_id"])) == 2  # no data lost


def test_complete_but_missing_expected_is_corrupted(store):
    make_study(store)
    session = make_session(store)
    store.ingest(envelope(session, 0, "session_start", {}))
    store.ingest(envelope(session, 1, "session_complete", {}))  # no decision/tsi/demographics
    report = _report(store, session)
    assert report["status"] == "complete"
    assert report["verdict"] == "corrupted"
    missing = [i for i in report["issues"] if i["category"] == "missing_expected_events"]
    assert missing and "decision" in missing[0]["detail"]


def test_mismatch_marks_corrupted(store):
    make_study(store)
    session = make_session(store)
    store.ingest(envelope(session, 0, "session_start", {}))
    store.ingest(envelope(session, 1, "decision", {}, participant_id="OTHER"))
    report = _report(store, session)
    assert report["verdict"] == "corrupted"
    assert any(
        i["category"] == "session_participant_mismatch" for i in report["issues"]
    )


def test_malformed_payload_marks_corrupted(store):
    make_study(store)
    session = make_session(store)
    store.ingest(envelope(session, 0, "decision", {}))  # missing required fields
    report = _report(store, session)
    assert report["verdict"] == "corrupted"
    assert any(i["category"] == "malformed_payload" for i in report["issues"])


def test_duplicate_counts_surfaced(store):
    make_study(store)
    session = make_session(store)
    ev = envelope(session, 0, "session_start", {})
    store.ingest(ev)
    store.ingest(ev)  # duplicate
    report = _report(store, session)
    assert report["duplicate_count"] == 1
    assert any(i["category"] == "duplicates" for i in report["issues"])
    assert report["verdict"] == "warning"


def test_partial_session_supports_later_resumption(store):
    make_study(store)
    session = make_session(store)
    store.ingest(envelope(session, 0, "session_start", {}))
    store.ingest(envelope(session, 1, "decision", {
        "scenarioId": "s", "decision": "trust",
        "probabilityPrediction": 0.5, "decisionTimeMs": 1,
    }))
    # "reload" — same session receives later events
    store.ingest(envelope(session, 2, "session_complete", {}))
    report = _report(store, session)
    assert report["status"] == "complete"
    assert report["event_count"] == 3
