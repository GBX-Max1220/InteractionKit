"""Export module tests (pure functions on stored events)."""

from __future__ import annotations

import csv
import io
import json

from app.export import export_csv, export_json
from app.store import Store

from .conftest import complete_session, make_study


def _events(store: Store, study_id: str = "demo"):
    return store.get_study_events(study_id)


def test_export_json_shape(store):
    make_study(store)
    complete_session(store, n_decisions=2)
    payload = json.loads(export_json("demo", _events(store)))
    assert payload["study_id"] == "demo"
    assert payload["event_count"] == 6
    ev = payload["events"][0]
    for key in ["event_id", "study_id", "session_id", "event_type",
                "schema_version", "sequence_number", "client_timestamp",
                "server_timestamp", "condition", "idempotency_key", "payload"]:
        assert key in ev
    # original payload preserved verbatim
    decision = next(e for e in payload["events"] if e["event_type"] == "decision")
    assert decision["payload"]["decision"] == "trust"


def test_export_csv_shape(store):
    make_study(store)
    complete_session(store, n_decisions=2)
    text = export_csv("demo", _events(store))
    rows = list(csv.reader(io.StringIO(text)))
    header = rows[0]
    assert "event_id" in header
    assert "sequence_number" in header
    assert "decision" in header  # flattened payload key
    assert len(rows) == 7  # header + 6 events


def test_csv_escaping_handles_commas_and_quotes(store):
    make_study(store)
    from .conftest import envelope, make_session

    session = make_session(store)
    store.ingest(envelope(session, 0, "decision", {
        "scenarioId": "s", "decision": "trust",
        "probabilityPrediction": 0.5, "decisionTimeMs": 1,
        "note": 'contains, "quotes" and\nnewline',
    }))
    text = export_csv("demo", _events(store))
    rows = list(csv.reader(io.StringIO(text)))
    assert len(rows) == 2
    assert 'contains, "quotes"' in rows[1][-1] or "newline" in rows[1][-1]
