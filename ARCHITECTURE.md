# InteractionKit Architecture

## Data Flow

```
/study/{id}
    │
    ├── 1. Load study config + scenarios
    ├── 2. Read URL params (PROLIFIC_PID, etc.)
    ├── 3. Check localStorage checkpoint
    │
    ├── 4. Consent → demographics
    ├── 5. Randomize condition + scenario order
    │
    ├── 6. For each of 10 scenarios:
    │     ├── Show question + AI answer
    │     ├── Show confidence pattern (v1/v2)
    │     ├── Collect probability estimate (slider)
    │     ├── Collect trust decision (3 choices)
    │     ├── Reveal ground truth
    │     ├── Collect familiarity rating
    │     └── Log decision event + advance checkpoint
    │
    ├── 7. TSI questionnaire
    └── 8. Debrief → CSV download → Prolific redirect
```

## Schema Design

The schema has three layers:

- **Core** (10 columns): participant_id, study_id, condition, pattern_version, scenario_id, event_type, timestamp, decision, decision_time_ms, probability_prediction
- **Optional measurement** (13 columns): tsi_01–tsi_12, tsi_mean
- **Familiarity** (1 column): familiarity (per-scenario 1-7 rating)

Ground truth (`answer_accurate`) is NOT in the CSV. It is resolved at analysis time by joining participant data with scenario data on `scenario_id`.

Derived metrics (brier_score, overtrust, undertrust) are computed by the analysis pipeline (`analysis/compute-brier.R`), not stored in the CSV.

## Pattern Abstraction

Patterns in InteractionKit are a research concept, not a software abstraction:

- v1 (confidence-only): numeric percentage only
- v2 (evidence-augmented): confidence + evidence sources + quality + explanation

There is no Pattern Engine, registry, or lifecycle system. Two conditions are selected via `if (condition === 'v1')` conditional rendering.

## Key Files

| File | Role |
|---|---|
| `schemas/log-event.schema.json` | Canonical data schema (SSOT) |
| `data/scenarios/fitness.json` | Stimulus materials with ground truth |
| `analysis/compute-brier.R` | Primary analysis pipeline |
| `lib/logger.ts` | Event collection → CSV export |

## Constraints

- Zero backend: no database, no auth, no API routes
- Zero LLM dependency: all stimuli are author-curated
- One page: `/study/[id]` is the only route
- Local first: CSV download as output format
