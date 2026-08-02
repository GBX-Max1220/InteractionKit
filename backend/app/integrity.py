"""Per-session integrity analysis.

The integrity report distinguishes three states:

* ``ok`` — no anomalies.
* ``warning`` — ordering / expectation anomalies (sequence gaps, out-of-order
  arrival, duplicate re-insertions, missing expected events in an incomplete
  session, invalid timestamps).
* ``corrupted`` — data-trust anomalies (session/participant mismatch,
  malformed payloads, invalid conditions, or a session marked complete while
  required event types are missing).

Incomplete is *status*, not a corruption verdict: a session still running is
expected to be missing its end event.
"""

from __future__ import annotations

from typing import Any

from .validation import (
    FLAG_INVALID_CLIENT_TS,
    FLAG_INVALID_CONDITION,
    FLAG_MALFORMED_PAYLOAD,
    FLAG_SESSION_PARTICIPANT_MISMATCH,
    FLAG_SESSION_STUDY_MISMATCH,
)


def _issue(category: str, detail: str, event_ids: list[str]) -> dict[str, Any]:
    return {"category": category, "detail": detail, "event_ids": sorted(set(event_ids))}


def analyze_session(session: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
    """Produce an IntegrityReport-shaped dict for a session and its events."""
    issues: list[dict[str, Any]] = []
    status = session["status"]

    # ── duplicates / rejected ────────────────────────────────────────────
    dup = int(session.get("duplicate_event_count", 0))
    rej = int(session.get("rejected_event_count", 0))
    if dup:
        issues.append(
            _issue("duplicates", f"{dup} event re-insertion(s) detected and skipped", [])
        )
    if rej:
        issues.append(
            _issue("rejected", f"{rej} event(s) rejected at ingestion", [])
        )

    # ── sequence gaps ────────────────────────────────────────────────────
    seqs = sorted({int(e["sequence_number"]) for e in events})
    if seqs:
        low, high = seqs[0], seqs[-1]
        expected = high - low + 1
        distinct = len(seqs)
        missing = [n for n in range(low, high + 1) if n not in set(seqs)]
        if distinct < expected:
            issues.append(
                _issue(
                    "sequence_gaps",
                    f"{expected - distinct} gap(s) in sequence {low}..{high}: "
                    f"missing {missing}",
                    [],
                )
            )

    # ── out-of-order arrival ─────────────────────────────────────────────
    # Arrival order is server_timestamp (tie-broken by insertion order). If the
    # sequence numbers are not non-decreasing in arrival order, events arrived
    # out of order. Data is preserved; the anomaly is reported.
    ordered_by_arrival = sorted(
        events,
        key=lambda e: (e["server_timestamp"], e.get("_rowid", 0)),
    )
    out_of_order: list[str] = []
    prev_seq: int | None = None
    for e in ordered_by_arrival:
        s = int(e["sequence_number"])
        if prev_seq is not None and s < prev_seq:
            out_of_order.append(e["event_id"])
        prev_seq = s
    if out_of_order:
        issues.append(
            _issue(
                "out_of_order",
                f"{len(out_of_order)} event(s) arrived out of sequence order",
                out_of_order,
            )
        )

    # ── stored validation flags ──────────────────────────────────────────
    flags_by_event: dict[str, list[str]] = {}
    for e in events:
        for f in e.get("flags", []):
            flags_by_event.setdefault(f, []).append(e["event_id"])

    _flag_issue(issues, flags_by_event, FLAG_SESSION_PARTICIPANT_MISMATCH,
                "event participant does not match session participant")
    _flag_issue(issues, flags_by_event, FLAG_SESSION_STUDY_MISMATCH,
                "event study does not match session study")
    _flag_issue(issues, flags_by_event, FLAG_MALFORMED_PAYLOAD,
                "malformed payload for event type")
    _flag_issue(issues, flags_by_event, FLAG_INVALID_CONDITION,
                "invalid condition value")
    _flag_issue(issues, flags_by_event, FLAG_INVALID_CLIENT_TS,
                "invalid client timestamp")
    _flag_issue(issues, flags_by_event, "future_client_timestamp",
                "client timestamp in the future")

    # ── expected events ──────────────────────────────────────────────────
    present_types = {e["event_type"] for e in events}
    if status == "complete":
        missing_expected = sorted(
            etype for etype in session.get("expected_event_types", [])
            if etype not in present_types
        )
        if missing_expected:
            issues.append(
                _issue(
                    "missing_expected_events",
                    f"session complete but missing required event types: {missing_expected}",
                    [],
                )
            )
    else:
        missing_expected = sorted(
            etype for etype in session.get("expected_event_types", [])
            if etype not in present_types and etype != session.get("end_event_type")
        )
        if session.get("end_event_type") not in present_types:
            issues.append(
                _issue(
                    "missing_expected_events",
                    "session not complete: missing end event "
                    f"{session.get('end_event_type')!r}",
                    [],
                )
            )
        if missing_expected:
            issues.append(
                _issue(
                    "missing_expected_events",
                    f"session still missing event types: {missing_expected}",
                    [],
                )
            )

    # ── verdict ──────────────────────────────────────────────────────────
    corruption_categories = {
        FLAG_SESSION_PARTICIPANT_MISMATCH,
        FLAG_SESSION_STUDY_MISMATCH,
        FLAG_MALFORMED_PAYLOAD,
        FLAG_INVALID_CONDITION,
    }
    if any(i["category"] in corruption_categories for i in issues):
        verdict = "corrupted"
    elif (
        status == "complete"
        and any(i["category"] == "missing_expected_events" for i in issues)
    ):
        verdict = "corrupted"
    elif issues:
        verdict = "warning"
    else:
        verdict = "ok"

    return {
        "session_id": session["session_id"],
        "status": status,
        "verdict": verdict,
        "event_count": len(events),
        "duplicate_count": dup,
        "rejected_count": rej,
        "issues": issues,
    }


def _flag_issue(issues, flags_by_event, flag: str, message: str) -> None:
    event_ids = flags_by_event.get(flag, [])
    if event_ids:
        issues.append(_issue(flag, f"{len(event_ids)} event(s): {message}", event_ids))
