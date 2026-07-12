# InteractionKit — Session State (2026-07-12)

## Status

Pre-pilot. 6 P0 blockers identified. Not yet pilot-ready.

---

## Frozen Decisions

| Decision | Status |
|---|---|
| Project name | `interactionkit` |
| Schema: answer_accurate not in CSV | Frozen (resolved via join) |
| Schema: tsi_mean kept in CSV | Frozen |
| Schema: page_refresh_count not added | Frozen (rejected) |
| Scenario balance: 4 correct / 6 incorrect | Frozen (with answer_accurate covariate) |
| Unsure handling: exclude from overtrust/undertrust, keep in Brier | Frozen |
| Trial order: slider BEFORE decision | Frozen (fixed) |
| Probability slider: no default, must interact | Frozen (fixed) |
| Familiarity covariate: 1-7 per scenario | Frozen (added) |
| Prolific params: PROLIFIC_PID, RETURN_URL | Frozen (implemented) |
| Sample size: pilot → power analysis → final N | Frozen (not yet determined) |
| Pattern: no Pattern Engine, conditional rendering | Frozen |
| No database, no auth, no Docker | Frozen |

---

## P0 Must Fix Before Pilot

| # | Issue | Files | Effort |
|---|---|---|---|
| 1 | Demographics form empty | `components/scenario-runner.tsx` | 30min |
| 2 | No attention check scenario | `data/scenarios/fitness.json` | 10min |
| 3 | 3 incorrect scenarios have non-diagnostic evidence quality | `data/scenarios/fitness.json` | 30min |
| 4 | No scenario random intercept in models | `analysis/compute-brier.R` | 5min |
| 5 | GLMM missing p-values (car::Anova) | `analysis/compute-brier.R` | 5min |
| 6 | JSON Schema missing $comment annotations | `schemas/log-event.schema.json` | 5min |

## P1 Monitor During Pilot

| # | Issue |
|---|---|
| 7 | Prolific URL param names unverified |
| 8 | Page refresh causes data loss for completed trials |
| 9 | R not in path — needs local setup |
| 10 | No example CSV for external reproducibility |

---

## File Map

### Source Files (interactionkit app)

| Path | Purpose |
|---|---|
| `C:\Users\gbx12\projects\interactionkit\app\study\[id]\page.tsx` | Single route, reads Prolific params |
| `C:\Users\gbx12\projects\interactionkit\components\scenario-runner.tsx` | Core state machine (all experiment phases) |
| `C:\Users\gbx12\projects\interactionkit\components\consent-screen.tsx` | IRB consent UI |
| `C:\Users\gbx12\projects\interactionkit\components\confidence-only.tsx` | v1 pattern (numeric confidence) |
| `C:\Users\gbx12\projects\interactionkit\components\evidence-augmented.tsx` | v2 pattern (confidence + evidence) |
| `C:\Users\gbx12\projects\interactionkit\components\probability-slider.tsx` | 0-100% slider, no default |
| `C:\Users\gbx12\projects\interactionkit\components\ground-truth-reveal.tsx` | Ground truth display |
| `C:\Users\gbx12\projects\interactionkit\components\familiarity-rating.tsx` | 1-7 per-scenario familiarity |
| `C:\Users\gbx12\projects\interactionkit\components\tsi-questionnaire.tsx` | 12-item TSI scale |
| `C:\Users\gbx12\projects\interactionkit\components\debrief-screen.tsx` | CSV download + Prolific return |
| `C:\Users\gbx12\projects\interactionkit\lib\logger.ts` | Event collection → CSV export |
| `C:\Users\gbx12\projects\interactionkit\lib\randomize.ts` | Fisher-Yates + condition assignment |
| `C:\Users\gbx12\projects\interactionkit\lib\checkpoint.ts` | localStorage crash recovery |
| `C:\Users\gbx12\projects\interactionkit\schemas\log-event.schema.json` | SSOT (needs $comment fix) |
| `C:\Users\gbx12\projects\interactionkit\types\log-event.ts` | TypeScript types |
| `C:\Users\gbx12\projects\interactionkit\data\scenarios\fitness.json` | 10 scenarios (needs evidence quality fix) |
| `C:\Users\gbx12\projects\interactionkit\data\studies\confidence-v1-v2.json` | Study config |
| `C:\Users\gbx12\projects\interactionkit\analysis\compute-brier.R` | Analysis pipeline (needs scenario RE + Anova) |

### Documents

| Path | Purpose |
|---|---|
| `C:\Users\gbx12\projects\interactionkit\README.md` | Project description |
| `C:\Users\gbx12\projects\interactionkit\ARCHITECTURE.md` | Architecture documentation |
| `C:\Users\gbx12\projects\interactionkit\PRE_REGISTRATION.md` | Pre-registration (ready for OSF upload) |
| `C:\Users\gbx12\projects\interactionkit\PILOT_READINESS_REVIEW.md` | Pre-pilot bug list |
| `C:\Users\gbx12\projects\interactionkit\review\consolidated_prepilot_action.md` | All reviews integrated |
| `C:\Users\gbx12\projects\interactionkit\test\qa-audit-report.md` | Full QA audit results |
| `C:\Users\gbx12\projects\interactionkit\test\qa-audit.mjs` | QA audit simulation script |
| `C:\Users\gbx12\projects\interactionkit\test\simulated-output.csv` | Sample CSV output |

### Spec Files (design history, in sandbox repo)

| Path | Purpose |
|---|---|
| `C:\Users\gbx12\projects\human-ai-interaction-sandbox\spec\00_PRD_v0.3.md` | Frozen PRD |
| `C:\Users\gbx12\projects\human-ai-interaction-sandbox\spec\03_implementation_spec.md` | Implementation spec |
| `C:\Users\gbx12\projects\human-ai-interaction-sandbox\spec\07_post_mvp_audit.md` | Post-MVP audit |
| `C:\Users\gbx12\projects\human-ai-interaction-sandbox\spec\08_external_review_evaluation.md` | External review evaluation |
| `C:\Users\gbx12\projects\human-ai-interaction-sandbox\docs\independent-reconstruction-spec.md` | Study 2 spec |

---

## Next Session: First Task

1. Fix P0 items 1-6 (estimated 1.5 hours total)
2. Run QA audit again to confirm all P0 resolved
3. Run internal pilot (N=5-10)
4. Update pre-registration with final sample size
5. Begin Study 1 data collection on Prolific

The dev server is at `http://localhost:3000/study/confidence-v1-v2`.
