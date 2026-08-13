"""API-level tests using FastAPI TestClient."""

from __future__ import annotations

from app.export import export_csv, export_json
from app.models import EventEnvelope

from .conftest import envelope, make_study


def _create_study(client):
    r = client.post("/studies", json={
        "study_id": "demo",
        "title": "Demo Study",
        "conditions": ["v1", "v2"],
    })
    assert r.status_code == 201
    return r.json()


def _create_session(client, participant="P001", condition="v1"):
    r = client.post("/sessions", json={
        "study_id": "demo", "participant_id": participant, "condition": condition,
    })
    assert r.status_code == 201
    return r.json()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["migrations"]["pending"] == []


def test_create_study_and_session(client):
    study = _create_study(client)
    assert study["conditions"] == ["v1", "v2"]
    session = _create_session(client)
    assert session["status"] == "in_progress"


def test_create_session_invalid_condition(client):
    _create_study(client)
    r = client.post("/sessions", json={
        "study_id": "demo", "participant_id": "P1", "condition": "v9",
    })
    assert r.status_code == 400


def test_post_event_then_duplicate(client):
    _create_study(client)
    session = _create_session(client)
    ev = {
        "event_id": "e1", "study_id": "demo", "participant_id": "P001",
        "session_id": session["session_id"], "event_type": "session_start",
        "schema_version": 1, "sequence_number": 0,
        "client_timestamp": "2026-08-01T00:00:00+00:00", "condition": "v1",
        "payload": {}, "idempotency_key": "e1",
    }
    r1 = client.post("/events", json=ev)
    assert r1.status_code == 201
    r2 = client.post("/events", json=ev)
    assert r2.status_code == 200  # duplicate → no-op, not an error
    events = client.get(f"/sessions/{session['session_id']}/events").json()
    assert len(events) == 1


def test_post_event_unsupported_schema_version(client):
    _create_study(client)
    session = _create_session(client)
    ev = {
        "event_id": "e2", "study_id": "demo", "participant_id": "P001",
        "session_id": session["session_id"], "event_type": "session_start",
        "schema_version": 99, "sequence_number": 0,
        "client_timestamp": "2026-08-01T00:00:00+00:00", "condition": "v1",
        "payload": {}, "idempotency_key": "e2",
    }
    r = client.post("/events", json=ev)
    assert r.status_code == 400
    assert "schema_version" in r.json()["detail"]


def test_post_event_idempotency_conflict(client):
    _create_study(client)
    session = _create_session(client)
    base = {
        "study_id": "demo", "participant_id": "P001",
        "session_id": session["session_id"], "event_type": "session_start",
        "schema_version": 1, "sequence_number": 0,
        "client_timestamp": "2026-08-01T00:00:00+00:00", "condition": "v1",
        "payload": {}, "idempotency_key": "same-key",
    }
    assert client.post("/events", json={**base, "event_id": "a"}).status_code == 201
    r = client.post("/events", json={**base, "event_id": "b"})
    assert r.status_code == 409
    assert "already used" in r.json()["detail"]


def test_batch_repeat_is_safe(client):
    _create_study(client)
    session = _create_session(client)
    batch = {
        "events": [
            {"event_id": f"b{i}", "study_id": "demo", "participant_id": "P001",
             "session_id": session["session_id"], "event_type": "session_start"
             if i == 0 else "decision", "schema_version": 1, "sequence_number": i,
             "client_timestamp": "2026-08-01T00:00:00+00:00", "condition": "v1",
             "payload": {} if i == 0 else {
                 "scenarioId": "s", "decision": "trust",
                 "probabilityPrediction": 0.5, "decisionTimeMs": 1},
             "idempotency_key": f"b{i}"}
            for i in range(3)
        ]
    }
    r1 = client.post("/events/batch", json=batch)
    assert r1.status_code == 200
    assert r1.json()["accepted"] == 3
    r2 = client.post("/events/batch", json=batch)
    assert r2.json()["duplicates"] == 3
    assert r2.json()["accepted"] == 0
    events = client.get(f"/sessions/{session['session_id']}/events").json()
    assert len(events) == 3


def test_integrity_endpoint(client):
    _create_study(client)
    session = _create_session(client)
    r = client.get(f"/sessions/{session['session_id']}/integrity")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "in_progress"
    assert body["verdict"] in ("ok", "warning")


def test_export_json_and_csv(client):
    _create_study(client)
    session = _create_session(client)
    for i in range(2):
        client.post("/events", json={
            "event_id": f"x{i}", "study_id": "demo", "participant_id": "P001",
            "session_id": session["session_id"], "event_type": "decision",
            "schema_version": 1, "sequence_number": i,
            "client_timestamp": "2026-08-01T00:00:00+00:00", "condition": "v1",
            "payload": {"scenarioId": f"s{i}", "decision": "trust",
                        "probabilityPrediction": 0.5, "decisionTimeMs": 10},
            "idempotency_key": f"x{i}",
        })
    rj = client.get("/studies/demo/export", params={"format": "json"})
    assert rj.status_code == 200
    body = rj.json()
    assert body["event_count"] == 2
    assert body["events"][0]["payload"]["decision"] == "trust"
    rc = client.get("/studies/demo/export", params={"format": "csv"})
    assert rc.status_code == 200
    lines = rc.text.strip().splitlines()
    assert "event_id" in lines[0]
    assert len(lines) == 3  # header + 2 rows
