# Study 2 Runtime Event Protocol v1

**Protocol version:** `study2-protocol-v1`
**Event schema:** `study2-event-v1`
**Scope:** runtime contract only; no participant-facing runner or pilot claim

## Separation from Study 1

The existing `ScenarioRunner` implements the earlier between-session `v1`/`v2` comparison and must not be reused as the Study 2 runner. Study 2 uses trial-level factorial assignment, an unaided initial decision, no trial-level ground-truth reveal, two post-AI judgments, and four recognition probes. A separate runtime must emit this contract.

## Frozen procedure order

Every completed session contains:

1. one `session_started` event;
2. one successful comprehension attempt, or one failed attempt followed by one successful retry;
3. one participant profile;
4. sixteen trials in the exact audited allocation order;
5. one post-task response with the attention-check result and one relevance rating per card type;
6. one `session_completed` event.

If both permitted comprehension attempts fail, the normal procedure cannot continue. The second failed attempt is preserved, followed by `session_terminated` with the sole allowed reason `comprehension_failed`; no profile, trial, or completion event may follow. This fail-safe path prevents the runner from fabricating eligibility or trapping an ineligible participant in an impossible state.

Each trial emits `trial_started`, `initial_response`, `ai_answer_shown`, `intervention_shown`, `post_ai_probability`, `final_response`, an optional scheduled `recognition_probe`, and `trial_completed`, in that order. Four probe indices are selected deterministically from the allocation seed and participant index so refresh recovery cannot resample them.

## Data minimization and leakage boundary

The event and nested payload schemas use strict field allowlists. Ground truth, provisional answer labels, authoring notes, reviewer identity, adjudication rationale, and hidden correctness feedback are not valid runtime fields. Ground truth remains outside the participant event stream until debrief generation. Material and allocation versions, trial context, phase-specific durations, initial/final decisions, confidence, AI-correct probability, familiarity, recognition, and post-task measures are retained because they are required by the frozen analysis or integrity audit.

## Recovery rule

Recovery must persist the append-only event prefix, not a freely editable phase number. `auditStudy2SessionPrefix` validates every event, binds it to the complete audited allocation and material version, and derives the only permissible next event. A malformed, reordered, skipped, cross-participant, or cross-version prefix has no resumable next step.

`Study2SessionStore` binds the participant-specific allocation projection with SHA-256 and stores each event in a forward hash chain over the previous hash and canonical event JSON. This detects accidental content replacement, deletion, reordering, and cross-allocation recovery; it is not a digital signature and does not defend against an attacker who can rewrite the complete chain.

Browser persistence uses two journal slots. The complete candidate state is written to `pending`, then copied to `active`, then removed from `pending`. Recovery audits both slots and chooses the longer valid chain, preferring `active` on an equal-length tie. A write interrupted between the two slots therefore preserves a recoverable candidate without accepting malformed JSON.

Only a store whose event stream passes the complete-session audit can produce `study2-completed-session-export-v1`. Prefixes remain resumable but cannot be exported as completed observations. The export retains the participant responses, allocation fingerprint, and final chain tip and therefore still requires the study's approved secure collection and retention procedure; local browser storage is not the research database.

## Readiness boundary

Passing allocation and event-contract tests proves structural trace validity only. It does not prove that answer variants, intervention cards, comprehension wording, participant UI, secure storage, debrief content, ethics approval, or pilot behavior are ready.
