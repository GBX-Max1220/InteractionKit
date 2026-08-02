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

## Private operator commands

After all three pair audits exist, place each completed resolution beside its queue as `<panel-id>.adjudication-resolution.json` inside `study2/private-review-artifacts/review-round-v2/`. Do not create a resolution for a panel whose queue is empty. Then run:

```text
npm run study2:finalize-reviews
```

The command requires exact panel and 27-candidate coverage, reconstructs every adjudication queue from its locked pair audit, rejects an edited or mismatched queue, validates every required resolution, and writes `final-review-outcomes.json` only in the gitignored private directory. It fails instead of generating partial outcomes.

Create a private `study2-final-freeze-selection-v1` JSON record only after reviewing the eligible outcomes and applying the predeclared selection rule without participant or pilot-outcome information. The repository never auto-selects candidates. Audit that record with:

```text
npm run study2:audit-final-freeze -- --selection <private-selection.json>
```

The command writes `final-freeze-audit.json` in the private directory and exits nonzero for an invalid selection. A written audit file is diagnostic evidence; only `valid: true` establishes that the structural freeze gate passed.

Both finalization stages bind their inputs with SHA-256 hashes. After a valid freeze, export the exact 24-item, reviewer-identity-free material set with:

```text
npm run study2:export-frozen-materials
```

The exporter re-reads and re-audits the outcome and selection files, verifies their hashes against the freeze audit, rejects path traversal or replaced inputs, and writes `frozen-materials-v1.json` in the private directory. It includes final labels and calibration boundaries but excludes reviewer IDs, adjudicator IDs, conflicts, rationales, and selector identity. Moving that artifact into a public or participant-facing location remains a separate preregistration and release decision.
