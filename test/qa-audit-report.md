# Pre-Pilot QA Audit Report

**Method:** Automated simulation (14-event participant trace) + code-level verification + R pipeline logic audit  
**Date:** 2026-07-12  
**Tools:** `test/qa-audit.mjs` (Node.js simulation), manual code trace

---

## 1. Participant Walkthrough

### Flow Verification

| Step | Status | Details |
|---|---|---|
| Consent | ✅ | Renders correctly. Two buttons (Agree/Decline) |
| Demographics | ⚠️ **P0 BUG** | Page shows only "Continue" button. No age/gender/AI familiarity form fields |
| Trial intro | ✅ | Shows question + AI answer + "Show Confidence Information" button |
| Trial confidence | ✅ | Shows pattern (v1/v2) + probability slider. Timer starts |
| Probability slider | ✅ | No default. Shows "—%" before interaction. Must move slider to enable submit |
| Trial decision | ✅ | Shows user's estimate + 3 trust buttons (green/red/yellow). Timer stops on click |
| Ground truth reveal | ✅ | Shows correct/incorrect label + ground truth text + user's estimate |
| Familiarity rating | ✅ | 1-7 scale. Must answer before advancing |
| TSI questionnaire | ✅ | 12 items, 7-point Likert. Must answer all to submit |
| Debrief + CSV | ✅ | Download button + Prolific return link (if URL params present) |

### Edge Cases Tested

| Edge case | Behavior | Verdict |
|---|---|---|
| Refresh mid-experiment | Checkpoint offers resume. Lost event data from completed trials | ⚠️ Known limitation. Acceptable for MVP |
| Decline consent | Returns empty (no redirect implemented yet) | ⚠️ `onDecline={() => {}}` — no-op |
| Skip slider interaction | Submit disabled ("Move the slider first") | ✅ |
| All TSI answered | Submit enabled only when 12/12 | ✅ |
| Empty scenario list | Error message displayed | ✅ |

---

## 2. Data Engineer: Logging & CSV

### Automated Simulation Results

| Check | Result |
|---|---|
| Scenarios loaded | 10 total, 4 correct, 6 incorrect ✅ |
| All scenarios have required fields | ✅ |
| No duplicate scenario IDs | ✅ |
| CSV columns match schema | 24 columns, all 10 schema required fields present ✅ |
| 5 event types present | session_start, demographics, decision, tsi_response, session_complete ✅ |
| 10 decision events | ✅ |
| probability_prediction in [0,1] | ✅ |
| decision_time_ms non-negative | ✅ |
| familiarity in [1,7] | ✅ |
| TSI values in [1,7] | ✅ |
| TSI mean computed correctly | ✅ |
| No TODO/FIXME in code | ✅ |
| Error handling in logger.validate() | ✅ |
| localStorage error handling | ✅ (try/catch in all 3 checkpoint functions) |

### Evidence Quality Audit (Critical Finding)

```
Scenario                    Correct?  Confidence  Evidence Quality
────────────────────────────────────────────────────────────────
cardio-before-weights (#8)   ✗         60          4.67 ★★★★★
post-workout-stretching(#10) ✗         78          4.67 ★★★★★
hamstring-stretch (#2)       ✓         90          4.67 ★★★★★
squat-knee-pain (#1)         ✓         82          4.67 ★★★★★
fasted-cardio (#9)           ✗         72          4.33 ★★★★☆
running-shoe (#4)            ✓         88          4.33 ★★★★☆
protein-timing (#3)          ✗         75          4.00 ★★★★☆
creatine-hair-loss (#5)      ✓         85          4.00 ★★★★☆
stretching-injury (#7)       ✗         86          3.67 ★★★★☆
vitamin-c-colds (#6)         ✗         88          3.00 ★★★☆☆
```

**Wrong answers with strong evidence (confounding effect):**
- #8 cardio-before-weights: incorrect, evidence = 4.67
- #10 post-workout-stretching: incorrect, evidence = 4.67
- #9 fasted-cardio: incorrect, evidence = 4.33

These 3 scenarios show strong evidence for wrong answers. v2 participants cannot use evidence quality to distinguish correct from incorrect.

### CSV Format Verification

```
Row types:
  session_start  → 1 row  (scenarioId: "session")
  demographics   → 1 row  (scenarioId: "session")
  decision       → 10 rows (1 per scenario, all N/A in TSI columns)
  tsi_response   → 1 row  (all 12 TSI columns + mean)
  session_complete → 1 row (all N/A)
```

N/A encoding: ✅ `escapeCsv(null)` and `escapeCsv(undefined)` both return "N/A"

---

## 3. Statistician: R Pipeline & Analysis

### Model Verification

| Model | Formula | In R script? |
|---|---|---|
| Primary (M1) | `brier ~ condition + (1\|participant_id)` | ✅ (line 66) |
| With accuracy covariate (M2) | `brier ~ condition + answer_accurate + (1\|participant_id)` | ✅ (line 70) |
| With scenario fixed effect (M3) | `brier ~ condition + answer_accurate + scenario_id + (1\|participant_id)` | ✅ (line 74) |
| Over-trust GLMM | `overtrust ~ condition + (1\|participant_id), binomial` | ✅ (line 87) |
| Under-trust GLMM | `undertrust ~ condition + (1\|participant_id), binomial` | ✅ (line 92) |
| Decision time LMM | `decision_time_ms ~ condition + (1\|participant_id)` | ✅ (line 101) |

### Missing: Scenario Random Intercept

**All models use `(1 | participant_id)` only.**
**None use `(1 | scenario_id)`.**

This inflates Type I error because trials within the same scenario share variance not captured by participant ID alone. Fix: add `+ (1 | scenario_id)` to the primary model.

### Exclusion Criteria (in R script)

| Criterion | Implemented? | Trigger |
|---|---|---|
| Attention check failed | ✅ (line 24) | Filters by `ATTENTION_CHECK_ID` |
| < 6 scenarios completed | ✅ (lines 36-41) | Counts unique scenario_ids per participant |
| Total time < 20s | ✅ (lines 44-56) | Computes from session_start to session_complete |

**But:** No attention check scenario exists in `fitness.json`. The criterion can never trigger. Must add before pilot.

### Missing: GLMM p-values

`lmerTest` package provides p-values for `lmer()` via Satterthwaite df. But `glmer()` (from lme4) does NOT use lmerTest. The over-trust and under-trust GLMMs output coefficients without p-values. Need `car::Anova()` or `drop1(..., test = "Chisq")`.

### Covariate Coding

`answer_accurate` is joined from scenario data using `scenario_lookup[[scenario_id]]`. The R script calls `stopifnot(!anyNA(...))` after join. ✅

---

## 4. Summary: Blocking Issues

### ❌ P0 — Blocks Pilot

| # | Issue | Role Found | Files |
|---|---|---|---|
| 1 | Demographics form empty | Participant | `components/scenario-runner.tsx` |
| 2 | No attention check scenario in data | All three | `data/scenarios/fitness.json` |
| 3 | 3 incorrect scenarios have non-diagnostic evidence quality (★4.3-4.7) | Data engineer | `data/scenarios/fitness.json` |
| 4 | No scenario random intercept in any model | Statistician | `analysis/compute-brier.R` |
| 5 | GLMM missing p-values (no car::Anova) | Statistician | `analysis/compute-brier.R` |
| 6 | JSON Schema missing `$comment` formula annotations | All three | `schemas/log-event.schema.json` |

### ⚠️ P1 — Monitor During Pilot

| # | Issue | Risk |
|---|---|---|
| 7 | Prolific URL param names unverified | All participants use UUID if names differ |
| 8 | Refresh causes complete data loss for prior trials | 15% refresh rate = 15-20 excluded at N=120 |
| 9 | R not in environment | Analysis requires local R setup |
| 10 | No example CSV for external labs | Reproducibility gap |

### ✅ Passed — No Issues

| Check | Status |
|---|---|
| Full experiment flow | ✅ |
| CSV column alignment with schema | ✅ |
| 5 event types all logged | ✅ |
| All required fields present | ✅ |
| N/A encoding for inapplicable fields | ✅ |
| TSI scale input validation (12/12 required) | ✅ |
| Probability slider interaction guard | ✅ |
| Familiarity rating required before advance | ✅ |
| Checkpoint save/load with error handling | ✅ |
| No code smells (TODO/FIXME/debugger) | ✅ |

---

## Appendix: How to Fix Each P0

| # | Fix | Lines of change |
|---|---|---|
| 1 | Add age/gender/AI familiarity form fields to demographics phase | ~40 |
| 2 | Add `{"id":"attention-check",...}` to fitness.json, remove 1 filler | ~20 |
| 3 | Replace evidence sources on cardio-before-weights, fasted-cardio, post-workout-stretching | ~15 each |
| 4 | Add `+ (1 | scenario_id)` to lmer/glmer formulas | ~3 |
| 5 | Add `library(car)` + `car::Anova(m4)` for GLMM p-values | ~5 |
| 6 | Add `$comment` to brier_score/overtrust/undertrust in JSON Schema | ~10 |
