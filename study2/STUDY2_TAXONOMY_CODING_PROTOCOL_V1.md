# Study 2 blinded taxonomy coding protocol v1

**Round:** `study2-taxonomy-coding-round-v1`
**Unit:** one authored AI answer, not one scenario
**Required sample:** all 96 answer variants, independently coded twice

## Independence contract

Two eligible coders receive separately randomized, blinded 96-answer packets. They must not have authored the answers or intervention cards, seen the private crosswalk, or been told the condition assignments or study hypotheses. The coordinator records a private stable-person identifier so one person cannot occupy both coder aliases. Training completion, absence of material-contribution conflict, hypothesis blindness, eligibility, verifier identity, and timestamps are mandatory. The generated roster and submission templates deliberately default to ineligible/incomplete states.

Packets expose only the decision prompt, response options, target population, answer text, and evidence-supported boundary and numerical granularity needed for construct coding. They exclude answer-variant IDs, intended failure family, correct/incorrect assignment, adjudicated binary ground truth, confidence condition, and intervention cards. Each coder receives a different deterministic shuffle derived from the frozen seed and coder alias.

## Decision rule

For each answer, coders first complete four binary criteria for unsupported numerical precision and four for an omitted decision boundary. They then assign exactly one label: `unsupported_numerical_precision`, `omitted_decision_boundary`, `both`, `neither`, or `unresolved`. The software rejects a label inconsistent with the eight criterion judgments. A decisive verbatim answer span, confidence score from 1–5, and rationale are required.

## Frozen gates

The pair audit computes exact raw agreement and multiclass Cohen's kappa over all 96 answers. Aggregate acceptance requires raw agreement at least .90 and kappa at least .80. Aggregate success does not rescue an individual answer: an answer is retained only when both coders agree and their common label equals its intended failure family. Every other answer enters `remove_or_third_coder_review`; no automatic majority, author override, or silent relabeling is permitted. All 96 must ultimately pass the per-answer gate before the delivery set can advance.

## Execution

After a completed delivery bundle passes the structural material audit, generate private packets:

```text
npm run study2:prepare-taxonomy-coding -- --bundle <completed-private-bundle.json> --seed <frozen-seed>
```

The command re-runs the delivery audit before writing anything. It creates coder packet JSON, human-readable Markdown forms, fail-safe submission templates, private crosswalks, a fail-safe coder roster, and a SHA-256 manifest under the gitignored review directory.

After both independent submissions and the roster are complete, run:

```text
npm run study2:audit-taxonomy-coding -- --bundle <completed-private-bundle.json> --first-submission <coder-a.json> --second-submission <coder-b.json> --coder-roster <roster.json>
```

The command verifies every generated source hash, validates identities and attestations, checks exact blind-ID coverage and criterion logic, unblinds only inside the coordinator workflow, and emits a hash-bound pair audit plus dispute queue. It exits nonzero unless both aggregate thresholds and complete per-answer retention are satisfied.

## Readiness boundary

Passing this protocol establishes only that the two selected failure constructs are independently recognizable in the answer texts. It does not establish card neutrality, visual/layout equivalence, participant comprehension, ecological validity, ethics readiness, or pilot readiness. Those remain separate blocking gates.
