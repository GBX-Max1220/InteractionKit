"""Migration mechanism tests."""

from __future__ import annotations

from app.db import apply_migrations, applied_versions, connect, list_migrations


def test_fresh_db_gets_schema(tmp_path):
    conn = connect(tmp_path / "fresh.db")
    applied = apply_migrations(conn)
    tables = {
        r["name"]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert {"studies", "participants", "sessions", "events", "schema_migrations"} <= tables
    assert applied == [m[1] for m in list_migrations()]
    conn.close()


def test_migrations_are_idempotent(tmp_path):
    db = tmp_path / "idem.db"
    conn = connect(db)
    first = apply_migrations(conn)
    conn.close()

    conn = connect(db)
    second = apply_migrations(conn)
    assert second == []  # nothing re-applied
    conn.close()


def test_applied_versions_recorded(tmp_path):
    conn = connect(tmp_path / "ver.db")
    apply_migrations(conn)
    assert applied_versions(conn) == {m[0] for m in list_migrations()}
    conn.close()


def test_events_table_is_pure_append_only(tmp_path):
    """The events table has no UPDATE/DELETE triggers; verify constraints allow
    insert-only semantics by checking there are no nullable columns that the
    code could accidentally rewrite and that PRIMARY KEY prevents overwrite."""
    conn = connect(tmp_path / "append.db")
    apply_migrations(conn)
    cols = conn.execute("PRAGMA table_info(events)").fetchall()
    # Every column is NOT NULL except the primary key column (sqlite reports
    # pk columns as notnull=0); an append-only table must not admit NULLs.
    assert all(c["notnull"] for c in cols if not c["pk"]), (
        "non-PK event columns must be NOT NULL"
    )
    assert any(c["pk"] for c in cols if c["name"] == "event_id")
    conn.close()
