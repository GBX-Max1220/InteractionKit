"""SQLite connection management and an explicit migration mechanism.

Migrations live in ``app/migrations/NNN_name.sql`` and are applied in numeric
order exactly once each, recorded in the ``schema_migrations`` table. Each
migration runs inside a single transaction; a migration that raises is rolled
back and re-applied on the next run.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable

from .config import db_path, ensure_db_dir

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def connect(db_file: str | Path | None = None) -> sqlite3.Connection:
    """Open a SQLite connection with WAL and strict row access.

    ``check_same_thread=False`` lets the FastAPI test client (which runs the
    app on a portal thread) share the connection with the test thread. Writes
    are serialized through one connection, so this is safe for this single-user
    system.
    """
    path = ensure_db_dir() if db_file is None else Path(db_file)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def list_migrations() -> list[tuple[int, str, str]]:
    """Return (version, name, sql) for every migration file, in order."""
    migrations: list[tuple[int, str, str]] = []
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = int(path.name.split("_", 1)[0])
        name = path.name
        migrations.append((version, name, path.read_text(encoding="utf-8")))
    return migrations


def applied_versions(conn: sqlite3.Connection) -> set[int]:
    """Return the set of migration versions already recorded."""
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)"
    )
    rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
    return {int(r["version"]) for r in rows}


def apply_migrations(conn: sqlite3.Connection) -> list[str]:
    """Apply pending migrations; return the names of the ones applied."""
    applied = set()
    try:
        applied = applied_versions(conn)
    except sqlite3.Error:
        # fresh file: table creation is handled inside applied_versions()
        conn.rollback()
        applied = applied_versions(conn)

    applied_names: list[str] = []
    for version, name, sql in list_migrations():
        if version in applied:
            continue
        conn.execute("BEGIN")
        try:
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
                (version, name, _utcnow()),
            )
            conn.commit()
            applied_names.append(name)
        except Exception:
            conn.rollback()
            raise
    return applied_names


def _utcnow() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def migration_status(conn: sqlite3.Connection) -> dict:
    """Return a human-readable migration status for /health."""
    all_m = list_migrations()
    applied = applied_versions(conn)
    return {
        "latest_version": max(v for v, _, _ in all_m) if all_m else 0,
        "applied_versions": sorted(applied),
        "pending": sorted(v for v, _, _ in all_m if v not in applied),
    }


def init_db(db_file: str | Path | None = None) -> sqlite3.Connection:
    """Open a connection with all migrations applied (idempotent)."""
    conn = connect(db_file)
    apply_migrations(conn)
    return conn
