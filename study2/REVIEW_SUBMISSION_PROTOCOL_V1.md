# Study 2 Independent Review Submission Protocol v1

**Materials:** `study2-candidates-v0.6`
**Packet schema:** `study2-domain-review-packet-v1`
**Submission schema:** `study2-domain-review-submission-v2`

## Independence contract

Two reviewers complete separately randomized packets before either reviewer sees the other's judgments, the author-side crosswalk, provisional answers, or provisional support labels. Reviewer IDs must be distinct. The crosswalk remains with the protocol maintainer and is used only after both submissions pass validation.

## Required reviewer metadata

- Stable reviewer ID
- Relevant domain expertise
- Conflict-of-interest statement
- ISO-8601 submission timestamp
- Packet seed and material version copied from the assigned packet

## Required judgment for every blind ID

- Binary decision: `option_a`, `option_b`, or `unresolved`
- Evidence-support level: `strong_consensus`, `mixed_or_conditional`, or `unresolved`
- Decision boundary that a calibrated answer must preserve
- Maximum defensible numerical granularity
- Missing or conflicting source concern; enter `None identified` when there is none
- Recommendation: `retain`, `revise`, or `reject`
- Written rationale

A reviewer cannot recommend `retain` while leaving either the binary decision or support level unresolved.

## Automated rejection conditions

A submission is invalid if it omits or duplicates a blind ID, includes an unknown blind ID, does not match its packet identity/version/seed, omits written justification, uses an invalid enum, lacks reviewer disclosures, or contains unexpected fields such as a candidate ID. These checks prevent accidental unblinding and incomplete review from entering adjudication.

## Pair audit and adjudication

After both submissions validate, reviewer-specific crosswalks map blind IDs back to candidates. A candidate enters adjudication when any of the following applies:

- Reviewers disagree on the binary decision.
- Reviewers disagree on the evidence-support level.
- Either reviewer selects `unresolved`.
- Either reviewer recommends `revise` or `reject`.

Only candidates with the same non-unresolved decision, the same non-unresolved support level, and two `retain` recommendations achieve full reviewer agreement. Agreement still does not automatically set `retained_v1`; the final 24-item, 12/12 support-level, and within-level 6A/6B answer-side constraints must be satisfied during freeze.

## Human-work boundary

The repository provides packets, validation, unblinding, and disagreement detection. It does not fabricate reviewer identities or judgments. Human reviewers must complete the two independent submissions before adjudication and final material freeze.

## Expertise-stratified assignments

Round v2 blocks candidate assignment by required expertise instead of assuming two generalists can validly review every topic. Each candidate is assigned to exactly two independent reviewers within one panel:

- Exercise physiology: exercise training, recovery, and environment (15 candidates)
- Sports nutrition: nutrition (8 candidates)
- Sports medicine: injury risk (4 candidates)

The reviewer is the unit of independent replication for each item. A person may not fill both reviewer assignments within the same panel. Relevant expertise and conflicts remain mandatory disclosures; a reviewer who cannot defend the assigned panel scope should decline or flag the affected item as unresolved.

Before dispatch, copy `reviewer-roster.template.json` to the gitignored private path `study2/private-review-artifacts/review-round-v2/reviewer-roster.completed.json`. Bind every assignment alias to a private stable person ID, document the required expertise, identity-verification method, COI, independence attestation, fixed or volunteer compensation basis, eligibility decision, verifier, and timestamp. A reviewer who contributed to the scenarios or source dossiers is ineligible, and compensation cannot depend on judgments or retention outcomes. The audit command fails closed when this roster is absent or invalid, and rejects the same person occupying both independent seats in one panel. Do not commit the completed roster or replace the stable private ID with public contact information.

## Generated round artifacts

Run `npm run study2:review-round` from the repository root. Public-safe packets, offline reviewer forms, blank submission templates, and an integrity manifest are written to `study2/review-round-v2/`. Each reviewer can open their assigned `.review-form.html` locally, save a browser-local draft, and download a schema-valid completed JSON without sending form data to a server. Reviewer-specific crosswalks are written to `study2/private-review-artifacts/review-round-v2/`, which is gitignored and must not be shared with reviewers or committed. The manifest records SHA-256 hashes for the public packets, forms, submission templates, and private crosswalks so the protocol maintainer can detect accidental replacement.

## Receipt and pair audit

Save completed reviewer files under `study2/private-review-artifacts/review-round-v2/`. Do not rename or edit the assigned packet, and do not place completed submissions in the public artifact directory. After both files for one panel arrive independently, run:

```text
npm run study2:audit-reviews -- --first <reviewer-01-submission.json> --second <reviewer-02-submission.json>
```

The command binds each submission to its reviewer-specific packet and expertise panel, verifies the committed packet and private crosswalk hashes, applies all submission and independence checks, and writes the unblinded `<panel-id>.pair-audit.json` only inside the gitignored private directory. Run it once for each of the three panels. After every panel has a valid pair audit, `round-audit-summary.json` verifies that all 27 candidates are covered exactly once at the unblinded pair level. A valid pair or complete round may still require adjudication; the command reports the exact count and does not promote any candidate to `retained_v1`.
