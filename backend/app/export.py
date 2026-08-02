"""Study export: JSON and CSV.

CSV flattens the envelope plus one level of payload keys. Payload keys are
camelCase (InteractionKit convention); they are emitted as-is so downstream R
analysis (compute-brier.R) can map them back to scenario data.
"""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any

ENVELOPE_COLUMNS = [
    "event_id",
    "study_id",
    "participant_id",
    "session_id",
    "event_type",
    "schema_version",
    "sequence_number",
    "client_timestamp",
    "server_timestamp",
    "condition",
    "idempotency_key",
]


def export_json(study_id: str, events: list[dict[str, Any]]) -> str:
    payload = {
        "study_id": study_id,
        "format": "json",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "event_count": len(events),
        "events": [
            {
                k: e[k]
                for k in ENVELOPE_COLUMNS + ["flags"]
            }
            | {"payload": e.get("payload", {})}
            for e in events
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def export_csv(study_id: str, events: list[dict[str, Any]]) -> str:
    payload_keys = _flattened_payload_keys(events)
    header = ENVELOPE_COLUMNS + ["flags"] + payload_keys
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(header)
    for e in events:
        payload = e.get("payload", {})
        if not isinstance(payload, dict):
            payload = {}
        row = [e.get(k, "") for k in ENVELOPE_COLUMNS]
        row.append(",".join(e.get("flags", [])))
        row.extend(str(payload.get(k, "")) for k in payload_keys)
        writer.writerow(row)
    return buf.getvalue()


def _flattened_payload_keys(events: list[dict[str, Any]]) -> list[str]:
    keys: list[str] = []
    seen: set[str] = set()
    for e in events:
        payload = e.get("payload", {})
        if isinstance(payload, dict):
            for k in payload:
                if k not in seen:
                    seen.add(k)
                    keys.append(k)
    return keys
