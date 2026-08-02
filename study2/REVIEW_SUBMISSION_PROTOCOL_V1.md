# Study 2 Independent Review Submission Protocol v1

**Materials:** `study2-candidates-v0.6`
**Packet schema:** `study2-domain-review-packet-v1`
**Submission schema:** `study2-domain-review-submission-v1`

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
