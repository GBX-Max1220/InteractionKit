-- Migration 001: initial schema.
-- Studies / participants / sessions are mutable state; events are append-only
-- (INSERT only — no UPDATE/DELETE is ever issued against `events`).

CREATE TABLE IF NOT EXISTS studies (
    study_id                TEXT PRIMARY KEY,
    title                   TEXT NOT NULL,
    description             TEXT NOT NULL DEFAULT '',
    conditions_json         TEXT NOT NULL,
    start_event_type        TEXT NOT NULL DEFAULT 'session_start',
    end_event_type          TEXT NOT NULL DEFAULT 'session_complete',
    expected_event_types_json TEXT NOT NULL,
    created_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
    participant_id          TEXT PRIMARY KEY,
    study_id                TEXT NOT NULL REFERENCES studies(study_id),
    external_id             TEXT,
    created_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id              TEXT PRIMARY KEY,
    study_id                TEXT NOT NULL REFERENCES studies(study_id),
    participant_id          TEXT NOT NULL REFERENCES participants(participant_id),
    condition               TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'in_progress',
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    completed_at            TEXT,
    first_event_at          TEXT,
    accepted_event_count    INTEGER NOT NULL DEFAULT 0,
    duplicate_event_count   INTEGER NOT NULL DEFAULT 0,
    rejected_event_count    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
    event_id                TEXT PRIMARY KEY,
    study_id                TEXT NOT NULL,
    participant_id          TEXT NOT NULL,
    session_id              TEXT NOT NULL REFERENCES sessions(session_id),
    event_type              TEXT NOT NULL,
    schema_version          INTEGER NOT NULL,
    sequence_number         INTEGER NOT NULL,
    client_timestamp        TEXT NOT NULL,
    server_timestamp        TEXT NOT NULL,
    condition               TEXT NOT NULL,
    payload_json            TEXT NOT NULL,
    idempotency_key         TEXT NOT NULL,
    flags_json              TEXT NOT NULL DEFAULT '[]',
    UNIQUE (session_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_events_session_seq ON events(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, server_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_study ON events(study_id);
CREATE INDEX IF NOT EXISTS idx_events_study_seq ON events(study_id, session_id, sequence_number);
