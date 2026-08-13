# Study 2 Delivery Material Protocol v1

**Bundle schema:** `study2-delivery-materials-v1`
**Prerequisite:** valid private `study2-frozen-materials-v1` artifact
**Scope:** answer/card authoring and structural audit; not pilot readiness

## Material count and identity

The final 24 base scenarios each require four AI-answer variants: two failure families crossed with correct versus incorrect core recommendations. This produces 96 answer variants. Every answer variant receives both intervention cards, producing 192 authored cards. Displayed confidence remains dynamic at 65% or 85% and is not authored into the answer text, yielding 384 delivery combinations without treating them as independent base materials.

Variant and card IDs are deterministic from scenario, failure, accuracy, and intervention identities. Correct variants use the adjudicated option; incorrect variants use the opposite option. The template computes this answer side but leaves every substantive text field and authoring check blank.

## Fail-safe template generation

After the expert-reviewed final freeze and identity-free frozen-material export, run:

```text
npm run study2:prepare-delivery-authoring -- --answer-version <version> --card-version <version>
```

The command requires exactly 24 frozen scenarios, hashes the source file, and writes a private 96-answer/192-card template plus authoring manifest under the gitignored review directory. The template is deliberately structurally invalid: answer text, decisive failure spans, failure-purity checks, card text, and citation IDs are blank.

## Structural authoring rules

Each answer must contain one verbatim `targetFailureSpan`, instantiate exactly the assigned failure family, exclude the other selected family, keep the core recommendation as the only accuracy-bearing proposition, and leave the dynamically rendered 65%/85% confidence outside the authored answer. These author declarations support drafting but do not replace the two-coder taxonomy protocol.

Each card uses the locked three-row layout. Numerical Warrant Cards use `Claimed value`, `Evidence-supported value`, and `Source`; Boundary Condition Cards use `Default applies when`, `Recommendation changes when`, and `Source`. Visible word count includes labels and row text, must be 35–45 words, and must match exactly inside each two-card pair. Each card cites one source ID present in that scenario's frozen dossier. A keyword screen rejects direct verdict cues such as “correct,” “wrong,” or “trust,” but independent leakage review remains mandatory.

Audit a completed private bundle with:

```text
npm run study2:audit-delivery-materials -- --bundle <completed-private-bundle.json>
```

The audit re-hashes the frozen input, verifies answer/card versions, checks exact 96/192 coverage, answer side, failure purity, target spans, layouts, word-count equality, prohibited verdict cues, and dossier citation membership. It writes a private hash-bound structural audit.

## Readiness boundary

`structurallyValid: true` always returns `pilotReady: false`. Pilot readiness additionally requires the frozen two-coder taxonomy thresholds, independent direct-verdict and layout-equivalence review, wording pretests, comprehension materials, approved ethics and preregistration artifacts, secure collection, and a tested participant runner. The structural audit cannot satisfy or fabricate those gates.
