# Study 2 Independent Domain Reviewer Packet

**Packet version:** `study2-domain-review-v1`
**Materials under review:** `study2-candidates-v0.6`

## Purpose

Review whether each candidate scenario has a defensible binary decision and whether its evidence support is best described as `strong_consensus` or `mixed_or_conditional`. This review does not assess the P/O interface manipulation, answer prose, or study hypotheses.

## Independence and blinding

1. Complete the review without consulting the other reviewer.
2. Do not inspect the other reviewer's form before submission.
3. The packet shown to reviewers must omit `provisionalSupportLevel`, candidate ID prefixes (`strong_` / `mixed_`), and authoring notes.
4. Candidate order must be independently randomized for each reviewer.
5. Reviewers may inspect linked sources and may nominate replacements.
6. Record conflicts of interest and relevant domain expertise before coding.

## Required decision for every scenario

Reviewers must provide all fields; `unresolved` is valid and preferable to forced agreement.

- Binary decision: `option_a`, `option_b`, or `unresolved`
- Evidence support: `strong_consensus`, `mixed_or_conditional`, or `unresolved`
- Decision boundary required for a calibrated answer
- Maximum defensible numerical granularity
- Material action: `retain`, `revise`, or `reject`
- Short rationale tied to the supplied sources
- Missing or conflicting source, if any

## Coding anchors

### `strong_consensus`

Current authoritative sources converge on the directional decision for the stated population and setting. Meaningful qualification may remain, but it does not reverse the binary decision under ordinary conditions.

### `mixed_or_conditional`

The preferable decision materially depends on population, timing, dose, outcome, or setting; or authoritative syntheses report meaningful heterogeneity or disagreement that prevents a general directional rule.

### `unresolved`

The supplied sources are insufficient, outdated, mismatched to the population/outcome, or genuinely unable to settle the proposed classification.

## Reviewer response schema

```text
schemaVersion: study2-domain-review-submission-v2
materialVersion: copied from the packet
reviewerId: copied from the packet
packetSeed: copied from the packet
relevantExpertise:
conflictOfInterestStatement:
submittedAt: ISO-8601 timestamp
items:
  - blindId: copied from the packet item
    binaryDecision: option_a | option_b | unresolved
    supportLevel: strong_consensus | mixed_or_conditional | unresolved
    decisionBoundary:
    numericalGranularity:
    sourceConcern: enter "None identified" when there is none
    recommendation: retain | revise | reject
    rationale:
```

## Acceptance and adjudication rules

- A scenario cannot be retained without two independent completed reviews.
- Both reviewers must agree on the binary decision and support level.
- Any `unresolved`, disagreement, or `revise` result triggers adjudication and, where needed, source replacement followed by re-review.
- Adjudication may resolve interpretation but cannot erase an unresolved evidence gap.
- Final pool requires exactly 24 retained scenarios: 12 per support level.
- Selection among otherwise eligible scenarios should maximize domain coverage and minimize obviousness, reading burden, and decision-risk imbalance.

## Construct-separation warning

Accuracy, evidence support, and communication failure are separate variables. A factually wrong answer is not automatically a P or O failure. A precise answer is not automatically unsupported. A conditional recommendation is not automatically omission-calibrated. Reviewers should only code the binary decision and evidence-support classification in this packet.

## Handoff checklist

- [ ] Reviewer identities and expertise recorded outside the blinded response file.
- [ ] Two independently randomized, label-blinded packets generated.
- [ ] Source links resolve and source metadata match the dossier.
- [ ] All required fields completed for all 27 source-dossier-complete candidates.
- [ ] Raw reviewer files preserved unchanged.
- [ ] Agreement statistics and disagreement list computed before adjudication.
- [ ] Every post-review wording change versioned and re-reviewed when substantive.
