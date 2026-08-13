"""Pydantic models for the InteractionKit study backend API.

The event envelope is the wire contract shared with the TypeScript client
(lib/sync.ts). ``server_timestamp`` is server-assigned and never accepted from
the client.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Studies ──────────────────────────────────────────────────────────────────

class StudyCreate(BaseModel):
    study_id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=256)
    description: str = ""
    conditions: list[str] = Field(default_factory=lambda: ["v1", "v2"])
    start_event_type: str = "session_start"
    end_event_type: str = "session_complete"
    # Event types that must each appear at least once in a *complete* session.
    expected_event_types: list[str] = Field(
        default_factory=lambda: [
            "session_start",
            "demographics",
            "decision",
            "tsi_response",
            "session_complete",
        ]
    )


class StudyRead(BaseModel):
    study_id: str
    title: str
    description: str
    conditions: list[str]
    start_event_type: str
    end_event_type: str
    expected_event_types: list[str]
    created_at: str


# ── Sessions ────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    study_id: str
    participant_id: str = Field(min_length=1, max_length=128)
    condition: str
    external_id: Optional[str] = None


class SessionRead(BaseModel):
    session_id: str
    study_id: str
    participant_id: str
    condition: str
    status: Literal["in_progress", "complete"]
    created_at: str
    updated_at: str
    completed_at: Optional[str]
    first_event_at: Optional[str]
    accepted_event_count: int
    duplicate_event_count: int
    rejected_event_count: int


# ── Events ──────────────────────────────────────────────────────────────────

class EventEnvelope(BaseModel):
    """One behavioral event as sent by the client."""

    event_id: str = Field(min_length=1, max_length=128)
    study_id: str
    participant_id: str
    session_id: str
    event_type: str = Field(min_length=1, max_length=64)
    schema_version: int
    sequence_number: int = Field(ge=0)
    client_timestamp: str
    condition: str
    payload: Any
    idempotency_key: Optional[str] = None  # defaults to event_id when absent


class EventBatchRequest(BaseModel):
    events: list[EventEnvelope]


class EventAcceptOutcome(BaseModel):
    status: Literal["accepted", "duplicate", "rejected"]
    event_id: str
    reason: Optional[str] = None
    stored_event_id: Optional[str] = None


class EventBatchResponse(BaseModel):
    session_id: str
    outcomes: list[EventAcceptOutcome]
    accepted: int
    duplicates: int
    rejected: int


class EventRead(BaseModel):
    event_id: str
    study_id: str
    participant_id: str
    session_id: str
    event_type: str
    schema_version: int
    sequence_number: int
    client_timestamp: str
    server_timestamp: str
    condition: str
    payload: Any
    idempotency_key: str
    flags: list[str]


# ── Integrity ───────────────────────────────────────────────────────────────

class IntegrityIssue(BaseModel):
    category: str
    detail: str
    event_ids: list[str] = Field(default_factory=list)


class IntegrityReport(BaseModel):
    session_id: str
    status: Literal["in_progress", "complete"]
    verdict: Literal["ok", "warning", "corrupted"]
    event_count: int
    duplicate_count: int
    rejected_count: int
    issues: list[IntegrityIssue]


# ── Health ──────────────────────────────────────────────────────────────────

class HealthRead(BaseModel):
    status: str
    app: str
    version: str
    db_path: str
    migrations: dict
