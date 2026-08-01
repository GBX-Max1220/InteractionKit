# InteractionKit Architecture

## Scope

InteractionKit contains two bounded paths:

```text
Legacy study:
Study configuration → Scenario Runner → CSV Logger → analysis

Pattern System:
PatternSpec registry → Composition validation → Pattern outputs
→ derived schema + self-describing JSONL
```

They coexist in the repository. The Pattern System does not replace or wrap the existing study runner, and this architecture does not claim that the two paths are behaviorally equivalent.

## Legacy Study Flow

```text
/study/{id}
    │
    ├── 1. Load study configuration and scenarios
    ├── 2. Read URL parameters
    ├── 3. Check localStorage checkpoint
    ├── 4. Consent and demographics
    ├── 5. Randomize condition and scenario order
    ├── 6. For each scenario
    │     ├── Show question and AI answer
    │     ├── Render confidence-only or evidence-augmented condition
    │     ├── Collect probability estimate and trust decision
    │     ├── Reveal ground truth
    │     ├── Collect familiarity
    │     └── Log decision event and advance checkpoint
    ├── 7. TSI questionnaire
    └── 8. Debrief and CSV download
```

### Legacy event schema

The legacy CSV schema has:

- **Core**: participant, study, condition, Pattern version, scenario, event, timestamp, decision, decision time, and probability estimate;
- **Optional measurement**: TSI responses and mean;
- **Familiarity**: per-scenario self-report.

Ground truth (`answer_accurate`) is not stored in the CSV. Analysis joins participant data with scenario data on `scenario_id`. Derived metrics such as Brier score, overreliance, and underreliance are computed in the analysis pipeline.

## Pattern System

Patterns are research-oriented typed specification objects.

They are software contracts for representing research interactions. They are not asserted to be validated psychological primitives.

### PatternSpec

`src/types.ts` defines the core contract:

```ts
interface PatternSpec {
  pattern: PatternName;
  version: string;
  construct: string;
  constructDefinition: string;
  input: JsonSchema;
  output: JsonSchema;
  params: JsonSchema;
  composition: {
    allowedAfter: PatternName[];
    allowedBefore: PatternName[];
  };
  measurementModel: {
    intendedConstruct: string;
    role: 'manipulated' | 'measured' | 'outcome';
  };
}
```

`intendedConstruct` documents design intent rather than established construct validity.

### Pattern primitives

The registry contains three primitives:

| Primitive | Intended construct | Role |
|---|---|---|
| `ConfidenceDisplay` | AI uncertainty representation | manipulated |
| `RelianceDecision` | Behavioral reliance on AI | measured |
| `OutcomeFeedback` | Decision outcome feedback | outcome |

Each JSON specification contains input, output, and parameter JSON Schema fragments plus composition ordering metadata.

### Experiment compositions

Experiment-level configurations are distinct from Pattern primitives:

| Composition | Implementation status |
|---|---|
| confidence-only | Existing study condition v1 |
| evidence-augmented | Existing study condition v2 |
| interactive | Pattern System demo sequence |

The interactive sequence is:

```text
ConfidenceDisplay(range)
    → RelianceDecision(binary)
    → OutcomeFeedback(immediate)
```

The confidence-only and evidence-augmented study conditions still use conditional rendering in `components/scenario-runner.tsx`. They are not currently encoded as Pattern System compositions.

### Composition validation

`src/composition.ts` implements:

- Sequence input/output compatibility checks;
- allowed-before and allowed-after checks;
- merged output-column derivation;
- compatible duplicate-column handling with origin tracking;
- Choice branch-column compatibility and branch indicators.

The returned `ValidationResult.valid` describes composition-contract compatibility. It is not a pattern-validity or research-validity judgment.

### Output validation and schema generation

`src/validation.ts` uses AJV to check renderer outputs against each Pattern's declared output schema.

`src/log.ts`:

1. checks the composition;
2. checks each Pattern output;
3. generates a derived row schema;
4. emits a self-describing JSONL header;
5. emits one row per Pattern instance per trial.

The derived schema includes `x-interactionkit-origin` metadata identifying which Pattern instances contribute each column.

### Renderer contract

Renderers in `src/patterns/` implement:

```ts
interface PatternRenderer<Input, Output, Params, UIState> {
  setup(input: Input, params: Params): UIState;
  collect(uiState: UIState): Output;
  validate(output: Output): boolean;
}
```

The renderer contract separates the declared data interface from the React presentation.

## Pattern System Module Map

| File | Responsibility |
|---|---|
| `src/types.ts` | PatternSpec, composition, derived-schema, renderer, and output types |
| `src/specs.ts` | Registry for the three Pattern specifications |
| `src/composition.ts` | Sequence/Choice checks and derived schema generation |
| `src/validation.ts` | AJV Pattern-output validation |
| `src/log.ts` | Self-describing JSONL serialization |
| `src/patterns/confidence-display.tsx` | ConfidenceDisplay renderer and variants |
| `src/patterns/reliance-decision.tsx` | RelianceDecision renderer |
| `src/patterns/outcome-feedback.tsx` | OutcomeFeedback renderer |
| `src/demo.tsx` | Interactive three-Pattern composition example |
| `app/patterns/page.tsx` | Route exposing the Pattern demo |

## Validation Boundary

Implemented validation concerns structural conformance:

- parameter schemas;
- required data availability;
- composition ordering;
- output-column compatibility;
- output row schemas.

Not implemented:

- construct validation;
- cross-lab reproducibility evaluation;
- interaction trace equivalence;
- required state or transition coverage.

These are research-validation questions, not conclusions supported by the current architecture.

## Constraints

- No backend, database, authentication, or API routes
- No runtime LLM dependency
- Local-first behavioral data export
- Legacy CSV and Pattern JSONL remain separate formats
- No automatic inference from schema compatibility to scientific validity
