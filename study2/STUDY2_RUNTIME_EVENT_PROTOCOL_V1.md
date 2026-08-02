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

Each trial emits `trial_started`, `initial_response`, `ai_answer_shown`, `intervention_shown`, `post_ai_probability`, `final_response`, an optional scheduled `recognition_probe`, and `trial_completed`, in that order. Four probe indices are selected deterministically from the allocation seed and participant index so refresh recovery cannot resample them.

## Data minimization and leakage boundary

The event and nested payload schemas use strict field allowlists. Ground truth, provisional answer labels, authoring notes, reviewer identity, adjudication rationale, and hidden correctness feedback are not valid runtime fields. Ground truth remains outside the participant event stream until debrief generation. Material and allocation versions, trial context, phase-specific durations, initial/final decisions, confidence, AI-correct probability, familiarity, recognition, and post-task measures are retained because they are required by the frozen analysis or integrity audit.

## Recovery rule

Recovery must persist the append-only event prefix, not a freely editable phase number. `auditStudy2SessionPrefix` validates every event, binds it to the complete audited allocation and material version, and derives the only permissible next event. A malformed, reordered, skipped, cross-participant, or cross-version prefix has no resumable next step.

## Readiness boundary

Passing allocation and event-contract tests proves structural trace validity only. It does not prove that answer variants, intervention cards, comprehension wording, participant UI, secure storage, debrief content, ethics approval, or pilot behavior are ready.
