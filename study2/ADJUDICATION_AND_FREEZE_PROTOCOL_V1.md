# Study 2 Adjudication and Final-Freeze Protocol v1

**Review round:** `study2-domain-review-round-v2`
**Candidate materials:** `study2-candidates-v0.6`

## Separation of stages

Independent review, adjudication, and final selection are separate stages. Preserve the two original submissions unchanged. Create the pair audit and adjudication queue before any reviewer discussion. Do not edit a raw judgment to make agreement appear higher.

## Permitted adjudication methods

Use one of two recorded methods:

- `third_expert`: a qualified person distinct from both original reviewers resolves an interpretation disagreement;
- `reviewer_consensus_after_lock`: the two original reviewers discuss only after both independent submissions are locked, and both resolver IDs are recorded.

The resolver must document qualifications, COI, independence, material-contribution status, timestamp, and a rationale for every queued candidate. A material author or dossier contributor is ineligible to adjudicate.

## Source-concern rule

Adjudication cannot erase a missing or conflicting source. When either reviewer identifies a source concern, `retain_without_change` is prohibited. The only valid dispositions are:

- `revise_and_re_review`: repair wording and/or evidence, version the candidate, then obtain a new independent review;
- `reject`: remove the candidate from the eligible pool.

Interpretive disagreement without a source concern—including different proposed boundary or granularity text—may be resolved to `retain_without_change`, but only with a non-unresolved binary decision, support level, canonical decision boundary, and canonical numerical granularity.

## Final outcome assembly

Candidates with full original agreement become retention-eligible without adjudication. Queued candidates become eligible only after a valid `retain_without_change` resolution. Revised candidates are not eligible until a new material version and independent re-review complete; `revise_and_re_review` is not a provisional retain state.

## Final selection

The final-freeze record must:

- exactly cover all 27 source-complete candidates with final review outcomes;
- select exactly 24 retention-eligible candidates;
- contain 12 `strong_consensus` and 12 `mixed_or_conditional` scenarios;
- contain 6 option-A and 6 option-B final decisions inside each support level;
- record the selection rule, selector, timestamp, and a reason for every eligible reserve not selected;
- use no participant outcome, treatment-effect, pilot-effect, or hypothesis-favoring information.

The code audits the constraints but does not choose the 24 candidates. This prevents an optimization routine from silently encoding author preference or maximizing a desired result.

## Freeze boundary

Passing final-freeze audit establishes only a review-complete, structurally balanced material set. It does not establish wording equivalence, failure-family validity, intervention-card equivalence, ethics approval, pilot usability, or participant-study readiness. Those remain separate gates.
