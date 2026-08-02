"""FastAPI routers for the InteractionKit study backend."""

from __future__ import annotations

import json
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from . import integrity, store
from .config import APP_NAME
from .db import migration_status
from .export import export_csv, export_json
from .models import (
    EventAcceptOutcome,
    EventBatchRequest,
    EventBatchResponse,
    EventEnvelope,
    EventRead,
    HealthRead,
    IntegrityReport,
    SessionCreate,
    SessionRead,
    StudyCreate,
    StudyRead,
)

router = APIRouter()

# The store is injected by main.create_app(); this indirection avoids a
# circular import between api and main.
_store: Optional[store.Store] = None


def set_store(st: store.Store) -> None:
    global _store
    _store = st


def get_store() -> store.Store:
    if _store is None:
        raise RuntimeError("store not initialized")
    return _store


StoreDep = Annotated[store.Store, Depends(get_store)]


def _404(exc: Exception, what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found: {exc}")


# ── Studies ──────────────────────────────────────────────────────────────────

@router.post("/studies", response_model=StudyRead, status_code=201)
def create_study(body: StudyCreate, st: StoreDep):
    return st.create_study(
        study_id=body.study_id,
        title=body.title,
        description=body.description,
        conditions=body.conditions,
        start_event_type=body.start_event_type,
        end_event_type=body.end_event_type,
        expected_event_types=body.expected_event_types,
    )


@router.get("/studies/{study_id}", response_model=StudyRead)
def get_study(study_id: str, st: StoreDep):
    try:
        return st.get_study(study_id)
    except store.StudyNotFoundError as exc:
        raise _404(exc, "study")


# ── Sessions ────────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionRead, status_code=201)
def create_session(body: SessionCreate, st: StoreDep):
    try:
        return st.create_session(
            study_id=body.study_id,
            participant_id=body.participant_id,
            condition=body.condition,
            external_id=body.external_id,
        )
    except store.StudyNotFoundError as exc:
        raise _404(exc, "study")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/sessions/{session_id}", response_model=SessionRead)
def get_session(session_id: str, st: StoreDep):
    try:
        return st.get_session(session_id)
    except store.SessionNotFoundError as exc:
        raise _404(exc, "session")


@router.get("/sessions/{session_id}/events", response_model=list[EventRead])
def get_session_events(session_id: str, st: StoreDep):
    try:
        st.get_session(session_id)  # ensure exists
    except store.SessionNotFoundError as exc:
        raise _404(exc, "session")
    return st.get_session_events(session_id)


@router.get("/sessions/{session_id}/integrity", response_model=IntegrityReport)
def get_session_integrity(session_id: str, st: StoreDep):
    try:
        session = st.get_session(session_id)
    except store.SessionNotFoundError as exc:
        raise _404(exc, "session")
    study = st.get_study(session["study_id"])
    events = st.get_session_events(session_id)
    session_view = dict(session)
    session_view["expected_event_types"] = study["expected_event_types"]
    session_view["end_event_type"] = study["end_event_type"]
    return integrity.analyze_session(session_view, events)


# ── Events ──────────────────────────────────────────────────────────────────

@router.post("/events", status_code=201)
def post_event(body: EventEnvelope, st: StoreDep):
    try:
        status, row, reason = st.ingest(body)
    except store.UnsupportedSchemaVersionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except store.IdempotencyConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except store.SessionNotFoundError as exc:
        raise _404(exc, "session")

    if status == "duplicate":
        return Response(
            status_code=200,
            content=json.dumps(row, ensure_ascii=False),
            media_type="application/json",
        )
    return row


@router.post("/events/batch", response_model=EventBatchResponse)
def post_event_batch(body: EventBatchRequest, st: StoreDep):
    if not body.events:
        raise HTTPException(status_code=400, detail="empty batch")
    session_id = body.events[0].session_id
    outcomes = st.ingest_batch(body.events)
    return EventBatchResponse(
        session_id=session_id,
        outcomes=[EventAcceptOutcome(**o) for o in outcomes],
        accepted=sum(1 for o in outcomes if o["status"] == "accepted"),
        duplicates=sum(1 for o in outcomes if o["status"] == "duplicate"),
        rejected=sum(1 for o in outcomes if o["status"] == "rejected"),
    )


# ── Export ──────────────────────────────────────────────────────────────────

@router.get("/studies/{study_id}/export")
def export_study(
    study_id: str,
    st: StoreDep,
    format: str = Query(default="json", pattern="^(json|csv)$"),
):
    try:
        st.get_study(study_id)
    except store.StudyNotFoundError as exc:
        raise _404(exc, "study")
    events = st.get_study_events(study_id)
    if format == "csv":
        return Response(
            content=export_csv(study_id, events),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{study_id}.csv"'},
        )
    return Response(
        content=export_json(study_id, events),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{study_id}.json"'},
    )


# ── Health ──────────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthRead)
def health(st: StoreDep):
    row = st.conn.execute("PRAGMA database_list").fetchone()
    path = row["file"] if row else "unknown"
    return HealthRead(
        status="ok",
        app=APP_NAME,
        version="0.1.0",
        db_path=path,
        migrations=migration_status(st.conn),
    )
