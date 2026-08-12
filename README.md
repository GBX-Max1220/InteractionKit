# InteractionKit

InteractionKit is a typed specification format for defining AI interaction experiments and generating structured behavioral data.

## Current Status

**Artifact version:** 1.0.0

**Release status:** Publicly tagged as `interactionkit-v1.0.0`; implementation verified locally and MIT licensed.

### Implemented

- versioned `PatternSpec` objects with typed input, output, parameter, composition, and measurement metadata;
- three Pattern primitives: `ConfidenceDisplay`, `RelianceDecision`, and `OutcomeFeedback`;
- Sequence and Choice composition compatibility checks;
- derived output-schema generation with column-origin tracking;
- schema-checked, self-describing JSONL serialization;
- an existing Human-AI trust study flow that exports behavioral data as CSV.

### Validation roadmap

- clarify whether intended constructs are interpreted consistently by researchers;
- evaluate independent implementations against the same specification;
- compare interaction traces across implementations.

These are validation targets, not completed results. Trace-convergence evaluation is outside the v1.0 artifact.

### Not claimed

- proven cross-lab reproducibility;
- empirically or psychometrically validated interaction primitives;
- behavioral, perceptual, or experiential equivalence across implementations;
- scientific validity implied by schema compatibility.

## PatternSpec

A `PatternSpec` is a research-oriented typed specification object. It defines an implementation-facing contract:

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

`intendedConstruct` records the construct the Pattern is designed to operationalize. It does not indicate that the construct mapping has been validated.

## Two Levels of Specification

### Pattern primitives

Pattern primitives define bounded interaction contracts:

| Primitive | Responsibility | Measurement role |
|---|---|---|
| `ConfidenceDisplay` | Represent an AI uncertainty signal using a stable output contract across display formats. | manipulated |
| `RelianceDecision` | Collect an observable rely/reject decision and derived reliance classification. | measured |
| `OutcomeFeedback` | Represent the decision outcome returned after a reliance choice. | outcome |

The JSON specifications live in `schemas/`; their React renderers live in `src/patterns/`.

### Experiment compositions

Experiment compositions arrange interactions into study-level configurations:

| Composition | Current implementation |
|---|---|
| **confidence-only** | Existing study condition v1, rendered by `components/confidence-only.tsx`. |
| **evidence-augmented** | Existing study condition v2, rendered by `components/evidence-augmented.tsx`. |
| **interactive** | Pattern System prototype sequence: `ConfidenceDisplay → RelianceDecision → OutcomeFeedback` in `src/demo.tsx`. |

The interactive composition is a prototype example, not a completed participant study condition. The two legacy study conditions remain conditionally rendered in the study runner; they have not been retrofitted into `SequenceComposition` objects.

## Composition and Schema Generation

`src/composition.ts` supports:

- **Sequence**: checks that required inputs are available from initial input or earlier Pattern outputs, checks allowed ordering, and merges output columns;
- **Choice**: checks branch schemas for compatible output columns and adds a branch indicator to the derived schema.

The derived JSON Schema records the Pattern instance origins of each column. This supports structural inspection and analysis preparation; it does not guarantee that independently implemented studies will produce equivalent data.

`src/log.ts` serializes one self-describing header followed by one JSON object per Pattern instance per trial. The header includes the composition, Pattern definitions, and derived row schema.

## Validation Boundary

### Implemented validation

- Pattern parameter validation with AJV;
- required input/output compatibility checks;
- allowed composition-order checks;
- output-column conflict checks;
- renderer output validation against the declared Pattern output schema;
- JSONL row validation before serialization.

These checks evaluate conformance to declared software contracts.

### Not yet implemented

- required interaction-state coverage;
- transition coverage;
- event-semantic preservation;
- independent-implementation trace convergence;
- construct validity.

## Running the Artifact

Prerequisites:

- Node.js 20.9.0 or newer;
- npm with lockfile v3 support.

```bash
npm ci
npm run dev
```

Routes:

- `http://localhost:3000/study/confidence-v1-v2` — existing confidence-only versus evidence-augmented study flow;
- `http://localhost:3000/patterns` — interactive Pattern System demonstration.

The `/patterns` route is the v1.0 typed-specification demonstration. The `/study` route is the pre-existing study flow and remains a separate implementation path.

## Reproducing the Release Checks

From a clean checkout:

```bash
npm ci
npm run test:patterns
npx tsc --noEmit
npm run build
```

The v1.0 artifact was verified on Node.js 24.16.0 and npm 11.13.0. Next.js requires Node.js 20.9.0 or newer.

## v1.0 Release Scope

The v1.0 research artifact consists of:

- the `PatternSpec` TypeScript contracts and JSON specifications;
- Sequence and Choice composition checks;
- derived output-schema generation;
- Pattern output validation and self-describing JSONL serialization;
- the three existing Pattern renderers and `/patterns` demonstration;
- Pattern System tests and release-facing documentation.

The legacy study flow remains in the repository for context but is not represented as a Pattern System composition. Study 2 planning, ethics materials, power-analysis outputs, review notes, and proposed future validation work are not evidence for the v1.0 software claim and should be versioned separately from the artifact release commit.

## Data Flows

```text
Legacy study:
Study configuration → Scenario Runner → Event Logger → CSV → Analysis

Pattern System:
PatternSpec registry → Composition validation → Pattern outputs
→ derived schema + self-describing JSONL
```

The legacy CSV records participant behavior. Ground truth is resolved by joining the CSV with scenario data on `scenario_id`. The Pattern System JSONL records typed Pattern outputs and embeds its row schema.

## Project Structure

| Directory | Purpose |
|---|---|
| `app/` | Next.js routes for the existing study and Pattern System demo |
| `components/` | Existing study UI components |
| `src/` | Pattern types, registry, composition checks, renderers, validation, JSONL serialization, and demo |
| `lib/` | Legacy study logger, randomization, and checkpoint logic |
| `data/scenarios/` | Stimulus materials with ground truth |
| `data/studies/` | Study configuration JSON |
| `schemas/` | Pattern specifications and legacy behavioral event schema |
| `types/` | Legacy study TypeScript types |
| `analysis/` | Analysis scripts |
| `test/` | Pattern System and study QA tests |

## Design Boundaries

- **Two existing paths.** The legacy study flow and Pattern System coexist; neither is presented as a replacement for the other.
- **No backend or database.** Data remain local and exportable.
- **No runtime LLM dependency.** Study stimuli are author-curated.
- **Schema checks are structural.** They do not validate psychological constructs or research outcomes.

## Dependencies

- Next.js 16 (App Router)
- TypeScript (strict mode)
- React 19
- Tailwind CSS
- AJV (JSON Schema validation)
- R analysis dependencies for the legacy study

## Build

```bash
npm run test:patterns
npx tsc --noEmit
npm run build
```

## Citation

If you use InteractionKit in research, please cite:

```bibtex
@software{guo_interactionkit_2026,
  author = {Guo, Baixin},
  title = {InteractionKit: Typed Specifications for AI Interaction Experiments},
  year = {2026},
  note = {Version 1.0.0; public tag interactionkit-v1.0.0},
  url = {https://github.com/GBX-Max1220/InteractionKit}
}
```

Associated paper status: pending; no paper or preprint is currently claimed.

## License

InteractionKit is licensed under the MIT License. See [LICENSE](LICENSE).
