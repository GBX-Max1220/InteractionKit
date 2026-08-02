# InteractionKit Study Backend

A minimal, local-first backend that gives the InteractionKit study runner
reliable ingestion, persistence, recovery, inspection, and export of
behavioral events. This is a bounded research-data system — not a general
agent platform, not a reliability testbed, not a commercial product.

## Architecture overview

```
InteractionKit frontend (Next.js, localhost:3000)
        │  fetch /events/batch etc. (CORS: localhost:3000)
        ▼
FastAPI (backend/app/main.py)  ──►  SQLite (WAL) at backend/data/events.db
        │
        ├── studies / participants / sessions   (mutable state)
        └── events                               (append-only log)
```

The frontend keeps its existing local-first design: events are pushed to the
in-memory `Logger` (CSV export unchanged) **and** to a new localStorage-backed
`SyncBuffer` (`lib/sync.ts`), which delivers them reliably to the backend:

* every event is buffered before it is sent;
* a failed upload keeps the event buffered for retry;
* retry never duplicates stored events (the server dedupes on `event_id` and
  `idempotency_key`);
* a page reload resumes the session and replays the buffer;
* acknowledged events are removed from the pending buffer.

The `Session Replay Viewer` (`/replay/<sessionId>`) is an internal inspection
page that shows one session's metadata, integrity status, ordered timeline,
payloads, and duplicate/gap/out-of-order/missing-event warnings.

## Local setup

Backend (Python 3.11+; requires fastapi, uvicorn, pydantic; httpx/pytest for
tests):

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Frontend (Node 20+):

```bash
cd ..                 # interactionkit repo root
npm install
npm run dev           # http://localhost:3000
```

The study runner posts to `http://localhost:8000` by default. Override with
`NEXT_PUBLIC_IK_BACKEND_URL` (e.g. for a remote/staged backend).

## Database location

* Default: `backend/data/events.db` (created on first run, WAL mode).
* Override: `IK_DB_PATH=/absolute/path/to/events.db` (the backend never
  hardcodes Windows paths).
* The DB and `backend/demo_exports/` are gitignored — study data is never
  committed.

## Migration command

Migrations are plain SQL files in `backend/app/migrations/` (`NNN_name.sql`)
applied in numeric order and recorded in `schema_migrations`. They run
automatically on startup; apply/verify explicitly with:

```bash
cd backend
python -c "from app.db import connect, apply_migrations; c = connect(); print(apply_migrations(c))"
```

Adding a schema change = drop a new `002_*.sql` file and restart. No rows are
ever mutated by migrations in the append-only `events` table.

## Event schema versioning

* The envelope `schema_version` is `1` (see `app/config.py`
  `SUPPORTED_SCHEMA_VERSIONS`).
* Unsupported versions are **rejected explicitly** (HTTP 400) and never
  stored.
* The original client `payload` is preserved verbatim in `payload_json`.
* Future plan: bump `ENVELOPE_SCHEMA_VERSION` to `2` in `config.py`, keep `1`
  readable, and migrate old rows on read. Additive payload fields need no
  schema bump because payloads are stored as-is.

## Test commands

Backend (pytest):

```bash
cd backend
python -m pytest tests/ -q
```

Frontend sync / view-model / viewer (node:test via tsx):

```bash
npx tsx --test test/sync.test.ts test/replay-view-model.test.ts test/replay-viewer.test.ts
```

No test hits the network or a paid API — the sync tests inject a fake `fetch`
and an in-memory storage shim; the viewer test renders with
`react-dom/server`.

## Synthetic demo command

One command starts the backend in-process and runs the whole reliability flow
against a synthetic 12-event session (failed delivery → retry → no duplicates
→ integrity report → JSON/CSV export):

```bash
cd backend
python scripts/demo_client.py
```

Outputs land in `backend/demo_exports/` and the run prints the replay-viewer
URL: `http://localhost:3000/replay/<session-id>` (open with `npm run dev`
running).

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/studies` | Create a study (conditions, expected event flow) |
| GET | `/studies/{id}` | Study metadata |
| POST | `/sessions` | Create a session (participant + condition) |
| GET | `/sessions/{id}` | Session metadata + status/counters |
| GET | `/sessions/{id}/events` | Events ordered by sequence |
| GET | `/sessions/{id}/integrity` | Integrity report (verdict + issues) |
| POST | `/events` | Ingest one event (idempotent) |
| POST | `/events/batch` | Ingest a batch (idempotent, partial failure safe) |
| GET | `/studies/{id}/export?format=json\|csv` | Study export |
| GET | `/health` | Liveness + migration status |

Idempotency semantics: re-sending the same `event_id` returns the stored event
(HTTP 200, no new row); re-using an `idempotency_key` with a *different*
`event_id` in the same session is a conflict (HTTP 409).

## Known limitations

* The study runner creates the backend session **after** consent; if the
  backend is down at that moment the participant still completes locally and
  the CSV export is the only record (no later auto-upload for that session).
* After a page reload the local CSV export only reflects buffered
  (not-yet-acked) events; the authoritative event set is the backend.
* `server_timestamp` is wall-clock UTC with no clock-sync guarantees; ordering
  analysis uses arrival order with an insertion tie-break.
* The sync layer removes rejected events from the pending buffer (they remain
  in the local CSV) to avoid infinite retry of permanently-refused events.
* No authentication, authorization, or multi-tenancy — this is a local
  single-researcher tool.
* CSV export flattens one level of payload keys; nested payload objects are
  JSON-stringified into their cell.

## Explicit non-goals

* Authentication / user accounts / multi-tenancy / billing.
* PostgreSQL, Redis, task queues, microservices.
* WebSockets (SSE is not used either — the replay viewer polls REST on load).
* OpenTelemetry integration or a generic agent-tracing substrate.
* DAG visualization, multi-run analytics dashboards, or a no-code study
  builder.
* A new research taxonomy or participant-facing analytics.
