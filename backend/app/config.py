"""Configuration for the InteractionKit study backend.

All paths are environment-overridable so the system is portable (no hardcoded
absolute Windows paths — a known liability elsewhere in this portfolio).
"""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "events.db"

# Envelope schema versions the backend understands.
# schema_version 1 = interactionkit envelope v1 (see API contract).
SUPPORTED_SCHEMA_VERSIONS = frozenset({1})

# Envelope version sent to new clients. Future event-level schema changes bump
# this and require a new migration + explicit rejection of older versions.
ENVELOPE_SCHEMA_VERSION = 1

# Maximum clock skew tolerated before a client_timestamp is flagged as being
# in the future (ISO-parseable but implausible).
FUTURE_CLIENT_TS_TOLERANCE_SECONDS = 300.0

APP_NAME = "interactionkit-study-backend"


def db_path() -> Path:
    """Resolve the SQLite database path (env IK_DB_PATH overrides default)."""
    override = os.environ.get("IK_DB_PATH")
    if override:
        return Path(override)
    return DEFAULT_DB_PATH


def ensure_db_dir() -> Path:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
