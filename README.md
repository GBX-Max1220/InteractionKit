# InteractionKit

A methodological infrastructure for producing structured, schema-mergeable behavioral data from Human-AI trust calibration experiments.

## Research Claim

Different implementations of the same HAI interaction pattern currently produce incompatible behavioral data. InteractionKit provides a versioned pattern interface and a mandatory structured log schema such that two independent implementations of the same experiment produce data that can be merged with minimal translation overhead.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000/study/confidence-v1-v2` in a browser.

## Experiment Flow

```
/study/{id}
  │
  ├── Consent
  ├── Demographics
  ├── Random assignment (v1: confidence only / v2: evidence-augmented)
  ├── 10 scenarios (randomized order):
  │     question → AI answer → confidence pattern →
  │     probability estimate → trust decision →
  │     ground truth reveal → familiarity rating
  ├── TSI questionnaire (Trust in Automation Scale)
  └── Debrief → CSV download → Return to Prolific
```

## Architecture

```
User interaction → Scenario Runner → Event Logger → CSV → Analysis Pipeline
```

The schema is the scientific contribution. The CSV records participant behavior (not experimenter knowledge). Ground truth is resolved by joining CSV output with scenario data files.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router — single page `/study/[id]` |
| `components/` | Experiment UI components |
| `lib/` | Logger, randomization, checkpoint |
| `data/scenarios/` | Stimulus materials with ground truth |
| `data/studies/` | Study configuration JSON files |
| `schemas/` | `log-event.schema.json` — canonical data schema |
| `types/` | TypeScript type definitions |
| `analysis/` | R analysis scripts |

## Key Design Decisions

- **No Pattern Engine.** Two conditions use conditional rendering, not an abstraction layer
- **No backend.** All state in browser memory + localStorage checkpoint
- **No database.** CSV is the output format
- **Schema-first.** All engineering decisions evaluated against: "does this serve the schema?"
- **Ground truth separation.** Participant behavior in CSV, scenario properties in `fitness.json`

## Dependencies

- Next.js 16 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Ajv (JSON Schema validation)
- R (analysis) with lmerTest, lme4, jsonlite

## Deployment

```bash
npm run build
# Deploy to Vercel or any static hosting
```

## Citation

If you use InteractionKit in your research, please cite:

```
[Citation placeholder — paper pending]
```

## License

[License TBD]
