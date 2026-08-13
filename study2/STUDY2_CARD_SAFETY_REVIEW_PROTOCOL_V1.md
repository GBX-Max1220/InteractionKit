# Study 2 intervention-card content-safety review protocol v1

**Round:** `study2-card-safety-round-v1`
**Unit:** one participant-visible intervention card
**Required sample:** all 192 authored cards, independently reviewed twice

## Construct boundary

The cards are interventions, so construct-relevant evidence is intentionally allowed. The review does not ask whether a card helps detect a precision or boundary problem; removing that information would destroy the manipulation. It asks whether the card introduces a shortcut outside the intended evidence mechanism.

Five prohibited properties are coded independently: direct right/wrong verdicts, instructions to trust or ignore the answer, cues to the displayed confidence condition or a prescribed probability response, answer-specific evaluation such as “this AI is wrong,” and claims exceeding the cited source’s finding, population, or limitations. A flagged property requires a verbatim participant-visible span. Every card requires a source-assessment rationale and confidence score.

## Blinding and independence

Two eligible non-authors each receive all 192 cards in different deterministic random orders. A packet includes the participant-visible decision, answer, card rows, and the cited source information required for claim checking. It excludes card IDs, answer-variant IDs, intervention-type fields, intended failure family, correct/incorrect assignment, adjudicated ground truth, confidence condition, and pair/match status. The coordinator-only crosswalk is SHA-bound and gitignored.

Private stable-person IDs prevent one person from occupying both reviewer aliases. Training, material-contribution conflict, hypothesis blindness, eligibility, verifier identity, and timestamps are mandatory. Generated roster and submission templates default to ineligible/incomplete states.

## Acceptance rule

Agreement is computed over all 960 binary judgments (192 cards × five criteria). Because prohibited cues should be rare and an all-negative review is possible, Cohen’s kappa is not used: it is undefined at zero prevalence and unstable under the prevalence paradox. Aggregate acceptance instead requires raw criterion agreement at least .90 and Gwet’s AC1 at least .80. A card is retained only when both reviewers agree on every criterion and both record all five prohibited properties as absent. Any flag or disagreement routes the card to `revise_and_rereview`; aggregate agreement cannot rescue it. All 192 cards must pass before content safety is complete.

## Execution

After a completed delivery bundle passes structural audit:

```text
npm run study2:prepare-card-safety-review -- --bundle <completed-private-bundle.json> --seed <frozen-seed>
```

After reviewers independently complete copied submission files and the coordinator completes a copied roster file:

```text
npm run study2:audit-card-safety-review -- --bundle <completed-private-bundle.json> --first-submission <reviewer-a.json> --second-submission <reviewer-b.json> --reviewer-roster <roster.json>
```

Preparation re-runs delivery structural audit before writing packets. Pair audit verifies the source bundle, evidence-dossier snapshot, every generated file hash, reviewer identities, exact coverage, response logic, and verbatim spans before unblinding. It writes a hash-bound private audit and revision queue, and exits nonzero unless both aggregate and per-card gates pass.

## Readiness boundary

This is a content-safety gate, not a visual-equivalence gate. It does not establish equal rendered height, density, contrast, reading time, salience, mobile behavior, accessibility, comprehension, or pilot readiness. Those claims require frozen participant UI, deterministic screenshots, automated geometry checks, and independent blinded presentation review.
