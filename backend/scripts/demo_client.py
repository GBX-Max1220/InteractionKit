"""End-to-end demonstration of the InteractionKit study backend.

Self-contained: starts uvicorn in a background thread, then drives the full
reliability flow against it with a synthetic session:

  1. health check
  2. create study + session
  3. build a synthetic event batch (session_start → demographics → decisions →
     confidence/evidence/revision/outcome → tsi → session_complete)
  4. simulate a failed delivery (post to a closed port)
  5. deliver the batch to the real backend
  6. re-send the same batch → verify no duplicate rows (re-insertions skipped)
  7. print the integrity report
  8. export JSON + CSV to files
  9. print the replay-viewer URL

Run:  python scripts/demo_client.py            (uses default port 8000)
      python scripts/demo_client.py --port 8010
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

BACKEND_DIR = Path(__file__).resolve().parent.parent
# Make `app` importable when running the script directly.
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

STUDY_ID = "demo"
CONDITION = "v1"
PARTICIPANT = "P-DEMO-001"
EXPECTED_EVENT_TYPES = [
    "session_start", "demographics", "decision", "confidence",
    "evidence_open", "decision_revision", "outcome", "familiarity",
    "tsi_response", "session_complete",
]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_batch(session: dict) -> list[dict]:
    """A synthetic but realistic InteractionKit session (12 events)."""
    events = [
        ("session_start", {"scenarioId": "session"}),
        ("demographics", {"age": "25-34", "gender": "female", "aiFamiliarity": 3}),
        ("decision", {"scenarioId": "fit-01", "decision": "trust",
                      "probabilityPrediction": 0.8, "decisionTimeMs": 1250}),
        ("confidence", {"scenarioId": "fit-01", "probabilityPrediction": 0.8}),
        ("evidence_open", {"scenarioId": "fit-01"}),
        ("decision_revision", {"scenarioId": "fit-01", "initialDecision": "trust",
                               "finalDecision": "distrust"}),
        ("outcome", {"scenarioId": "fit-01", "answerAccurate": True}),
        ("familiarity", {"scenarioId": "fit-01", "familiarity": 4}),
        ("decision", {"scenarioId": "fit-02", "decision": "distrust",
                      "probabilityPrediction": 0.35, "decisionTimeMs": 980}),
        ("outcome", {"scenarioId": "fit-02", "answerAccurate": False}),
        ("tsi_response", {"tsiMean": 4.25}),
        ("session_complete", {"scenarioId": "session"}),
    ]
    batch = []
    for seq, (event_type, payload) in enumerate(events):
        event_id = uuid.uuid4().hex
        batch.append({
            "event_id": event_id,
            "study_id": STUDY_ID,
            "participant_id": session["participant_id"],
            "session_id": session["session_id"],
            "event_type": event_type,
            "schema_version": 1,
            "sequence_number": seq,
            "client_timestamp": utcnow(),
            "condition": session["condition"],
            "payload": payload,
            "idempotency_key": event_id,
        })
    return batch


def wait_for_health(client: httpx.Client, base: str, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = client.get(f"{base}/health")
            if r.status_code == 200:
                print(f"[ok] backend healthy at {base} "
                      f"(version {r.json()['version']})")
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.25)
    raise SystemExit("ERROR: backend did not become healthy in time")


def run_demo(port: int) -> None:
    base = f"http://127.0.0.1:{port}"
    with httpx.Client(timeout=30.0) as client:
        wait_for_health(client, base)

        # ── 2. study + session ────────────────────────────────────────────
        r = client.post(f"{base}/studies", json={
            "study_id": STUDY_ID,
            "title": "Demo Study",
            "conditions": [CONDITION],
            "expected_event_types": EXPECTED_EVENT_TYPES,
        })
        r.raise_for_status()
        print(f"[ok] study {STUDY_ID} ready")

        r = client.post(f"{base}/sessions", json={
            "study_id": STUDY_ID,
            "participant_id": PARTICIPANT,
            "condition": CONDITION,
        })
        r.raise_for_status()
        session = r.json()
        sid = session["session_id"]
        print(f"[ok] session created: {sid}")

        batch = build_batch(session)
        n = len(batch)

        # ── 4. simulate failed delivery (closed port) ─────────────────────
        try:
            client.post(f"http://127.0.0.1:9/events/batch",
                        json={"events": batch})
        except httpx.HTTPError as exc:
            print(f"[sim] simulated failed delivery: {type(exc).__name__} — "
                  f"events retained client-side for retry")

        # ── 5. deliver to the real backend ────────────────────────────────
        r = client.post(f"{base}/events/batch", json={"events": batch})
        r.raise_for_status()
        res = r.json()
        print(f"[ok] delivered batch: accepted={res['accepted']} "
              f"duplicates={res['duplicates']} rejected={res['rejected']}")

        # ── 6. re-send the same batch → no duplicate rows ─────────────────
        r = client.post(f"{base}/events/batch", json={"events": batch})
        r.raise_for_status()
        res2 = r.json()
        assert res2["accepted"] == 0, "resend must not accept anything new"
        print(f"[ok] re-sent same batch: accepted={res2['accepted']} "
              f"duplicates={res2['duplicates']} — no duplicate rows created")

        stored = client.get(f"{base}/sessions/{sid}/events").json()
        assert len(stored) == n, f"expected exactly {n} unique events, got {len(stored)}"
        print(f"[ok] event store holds exactly {len(stored)} unique events")

        # ── 7. integrity report ───────────────────────────────────────────
        r = client.get(f"{base}/sessions/{sid}/integrity")
        r.raise_for_status()
        report = r.json()
        print("[integrity]")
        print(json.dumps(report, indent=2))
        print("  note: duplicate_count>0 is the resend-detection proof above; "
              "no duplicate rows were stored.")

        # ── 8. exports ────────────────────────────────────────────────────
        out = BACKEND_DIR / "demo_exports"
        out.mkdir(exist_ok=True)
        rj = client.get(f"{base}/studies/{STUDY_ID}/export", params={"format": "json"})
        rj.raise_for_status()
        (out / "demo_export.json").write_text(rj.text, encoding="utf-8")
        rc = client.get(f"{base}/studies/{STUDY_ID}/export", params={"format": "csv"})
        rc.raise_for_status()
        (out / "demo_export.csv").write_text(rc.text, encoding="utf-8")
        print(f"[ok] JSON export  -> {out / 'demo_export.json'} "
              f"({rj.json()['event_count']} events)")
        print(f"[ok] CSV export   -> {out / 'demo_export.csv'}")

        # ── 9. replay viewer URL ──────────────────────────────────────────
        print("\n── demo complete ──────────────────────────────────────")
        print(f"Replay viewer: http://localhost:3000/replay/{sid}")
        print("(requires `npm run dev` in the interactionkit repo)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    # Start uvicorn in a background thread so the demo is one command.
    import uvicorn

    from app.main import app as fastapi_app

    config = uvicorn.Config(fastapi_app, host="127.0.0.1", port=args.port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    try:
        run_demo(args.port)
    finally:
        server.should_exit = True
        thread.join(timeout=5.0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
