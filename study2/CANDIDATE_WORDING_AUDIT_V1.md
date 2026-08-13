# Study 2 Candidate Wording Audit v1

**Audit target:** `study2-candidates-v0`
**Result:** fail; replaced by `study2-candidates-v0.1`
**Audit date:** 2026-08-02

## Why the original candidate wording failed

The original pool frequently contrasted a qualified recommendation with an implausible absolute foil using terms such as “always,” “every,” “sole,” “ignore,” or “unchanged indefinitely.” Those contrasts created three threats:

1. participants could choose the qualified option using test-taking heuristics rather than domain knowledge;
2. mixed/conditional scenarios used absolute language more often than strong-consensus scenarios, leaking the evidence-support factor;
3. the apparently correct option tended to occupy a predictable side, risking answer-side aliasing with evidence support.

Completing evidence dossiers for those wordings would have validated the topic but not the decision task. The pool was therefore revised before the remaining source search.

## Changes in v0.1

- Replaced absolute or absurd foils with two actionable, superficially plausible alternatives.
- Added concrete populations, goals, symptoms, or timing contexts where needed to preserve a defensible binary decision.
- Removed participant-visible shortcut terms enforced by an automated audit.
- Added an eight-word maximum warning threshold for option-length imbalance; the current pool triggers no such warning.
- Added hidden `provisionalCorrectOption` metadata for authoring audits only.
- Reordered options so the 16 provisional strong-consensus candidates are split 8/8 between option A and option B.
- Preserved `unresolved` for three mixed candidates where author judgment should not pre-empt domain review.
- Added a pilot-readiness requirement that each final 12-scenario support stratum contain six option-A and six option-B ground truths.

## Remaining validity gates

Passing the lexical audit does not establish task validity. Before retention, each candidate still needs:

- at least two metadata-verified authoritative sources;
- two independent domain judgments on the binary decision and support level;
- revision or rejection when reviewers judge both options equivalent or the decision boundary underspecified;
- a separate general-population pretest of option plausibility, difficulty, and answer leakage;
- re-review after any substantive wording change.

## Explicit interpretation boundary

`provisionalCorrectOption` records the author's current intent and is excluded from reviewer-visible packets. It is not ground truth. The two independent review records, not this field, determine the adjudicated correct option.
