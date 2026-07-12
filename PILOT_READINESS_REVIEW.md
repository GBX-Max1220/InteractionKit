# Pilot Readiness Review — InteractionKit v0.3

**Reviewer:** Senior HCI Experiment Engineer  
**Date:** 2026-07-12  
**Method:** Full file audit of scenario-runner.tsx, logger.ts, page.tsx, debrief-screen.tsx, compute-brier.R, fitness.json  
**Scope:** Pre-pilot bug detection only. No architecture redesign.

---

## P0 — Bugs to Fix Before Pilot

### P0.1 — Demographics form is empty

**Location:** `components/scenario-runner.tsx` lines 189-211  
**Issue:** The demographics phase renders only a "Continue to Experiment" button with no form fields. Age, gender, and AI familiarity (1-7) are specified in the PRD and pre-registration but are not collected.  
**Impact:** Missing demographic covariates. Cannot describe sample. Cannot test whether conditions differed on AI familiarity.  
**Fix:** Add age (number 18-99), gender (Male/Female/Non-binary/Prefer not to say), and AI familiarity (1-7) fields to the demographics page. Log as a single `demographics` event with these fields stored.  
**Effort:** ~30 min  
**File:** `components/scenario-runner.tsx` (add form UI + logging), `schemas/log-event.schema.json` (optional demographics fields), `types/log-event.ts`

### P0.2 — No attention check scenario exists

**Location:** `analysis/compute-brier.R` line 20 references `ATTENTION_CHECK_ID <- "attention-check"`, but `data/scenarios/fitness.json` has no scenario with this ID.  
**Issue:** The exclusion criterion for attention checks can never trigger because there is no attention check trial in the data. Pre-registration specifies attention check as an exclusion criterion.  
**Impact:** Cannot detect random/bot responses. Invalidates the pre-registered exclusion criterion.  
**Fix:** Add one scenario with `id: "attention-check"` where the question/answer text instructs the participant to "Select 'Trust' for this item." Mark it as attention check in the scenario data. The R script already handles this — the missing piece is the data.  
**Effort:** ~10 min  
**Files:** `data/scenarios/fitness.json` (add 1 scenario + remove 1 filler to keep 10 total)

### P0.3 — R script `study_id` column mismatch

**Location:** `analysis/compute-brier.R` line 20 reads CSV with default `read.csv()`.  
**Issue:** The R script does not read or use `study_id`. The column IS in the CSV (confirmed in `lib/logger.ts` header). The R script drops it silently when filtering columns for the model. This is not a bug for Study 1, but the script should validate that `study_id` exists and is consistent.  
**Impact:** For Study 1 alone: none. For pooled analysis later: the pooled script must handle this correctly.  
**Fix:** Add `stopifnot("study_id" %in% colnames(participants))` at the top of the analysis.  
**Effort:** 2 min

### P0.4 — R script missing lmerTest in GLMM

**Location:** `analysis/compute-brier.R` lines 136-162  
**Issue:** The GLMM models (`glmer`) use `lme4` directly. `library(lmerTest)` only affects `lmer`, not `glmer`. `glmer` from `lme4` does not provide p-values. For binary outcomes, the recommended approach is `car::Anova()` or `drop1()` to get p-values for the condition effect.  
**Impact:** The overtrust/undertrust secondary analyses will have coefficients without p-values.  
**Fix:** Either load `car` and use `car::Anova(m4)` for Type III Wald chi-square tests, or use `drop1(m4, test = "Chisq")`. Recommend `car::Anova()` as it's more standard in CHI papers.  
**Effort:** 5 min  

---

## P1 — Risks to Address Before Full Data Collection

### P1.1 — Page refresh causes data loss

**Location:** `components/scenario-runner.tsx`  
**Issue:** Logger is in-memory. On refresh, all event data from completed trials is lost. The checkpoint saves only `participantId`, `condition`, `scenarioOrder`, and `currentScenarioIndex`. When a participant refreshes on trial 7 and continues, the CSV contains only trials 7-10 (4 events). The pre-registered exclusion criterion (< 6 scenarios) excludes this participant.  
**Impact:** Each refresh costs one participant's data + Prolific compensation ($2-3). At 15% refresh rate for N=120, that's 15-20 excluded participants = $30-60 in lost compensation.  
**Risk level:** MEDIUM. Acceptable given budget ($500/month). Monitor refresh rate in pilot.  
**Mitigation (during pilot):** Log `page_refresh_count` in checkpoint and report Pilot refresh rate. If > 20%, reconsider checkpoint strategy.

### P1.2 — Prolific URL parameter names unverified

**Location:** `app/study/[id]/page.tsx` lines 29-31  
**Issue:** The code reads `PROLIFIC_PID` and `RETURN_URL` from URL query parameters. These parameter names are based on Prolific documentation but have not been tested with an actual Prolific study configuration.  
**Impact:** If Prolific uses different parameter names (e.g., `PROLIFIC_ID` instead of `PROLIFIC_PID`), all participants will use generated UUIDs and demographic linkage will be lost.  
**Risk level:** HIGH. Must be tested with Prolific Preview mode before paid recruitment.  
**Mitigation:** Set up a dummy Prolific study, navigate to the study URL from Preview mode, inspect the actual URL parameters passed.

### P1.3 — Scenario join failure silent in R script

**Location:** `analysis/compute-brier.R` lines 42-57  
**Issue:** If `scenario_id` is not found in the lookup, the script produces NA and `stopifnot(!anyNA(...))` stops execution with an unhelpful error. For Study 1 this is unlikely (same repo). For Study 2, the error message should identify which scenario_ids are missing.  
**Impact:** Study 2 integration fails without clear diagnostic message.  
**Risk level:** LOW for Study 1. MEDIUM for Study 2.  
**Fix already applied:** The current script has a `warning()` that lists unmatched IDs (line 49-51), followed by `stopifnot`. This is sufficient.

### P1.4 — TSI mean defaults to 0 for missing responses

**Location:** `components/scenario-runner.tsx` lines 142-143  
**Issue:** `tsiMean` defaults to 0 if fewer than 12 items are answered. This would be logged as a valid TSI response with mean 0, which is indistinguishable from a genuine response (all items rated 1).  
**Impact:** Misleading data if a participant skips the TSI questionnaire.  
**Risk level:** LOW. The TSI UI requires all 12 items to be answered before submission. But if a future version removes this guard, the default would be incorrect.  
**Fix:** Change default to `null` (excluded from CSV as N/A) when fewer than 12 items answered.

### P1.5 — R script column alignment is manual

**Location:** `lib/logger.ts` → `analysis/compute-brier.R`  
**Issue:** The CSV column names are defined in `lib/logger.ts` (TypeScript). The R script assumes these column names but has no validation that the CSV matches. If a column is renamed or reordered, the R script silently reads the wrong data.  
**Impact:** Silent data corruption if schema and analysis script drift apart.  
**Risk level:** LOW for pilot (single developer, single experiment). RISES with multiple experiments.  
**Mitigation:** The Logger's `validate()` method rejects invalid events. This catches bugs at data generation time, not analysis time. Consider adding a `validate_csv.R` helper that checks column names match expected.

---

## P2 — Improvements (Defer Until After Data Collection)

### P2.1 — Demographics stored as separate events (not ideal for analysis)

**Issue:** Age, gender, and AI familiarity are logged as a single `demographics` event row, while the core analysis works on `decision` event rows. Analysis scripts need to join participant-level data across event types.  
**Suggestion:** Store participant-level covariates (age, gender, AI familiarity) in a separate CSV or append them to every decision row.

### P2.2 — `session_start` and `demographics` events contain placeholder values

**Issue:** Event types like `session_start` and `demographics` include `decision: "trust"`, `probabilityPrediction: 0`, `decisionTimeMs: 0`. These are placeholders required by the strict schema but are semantically incorrect.  
**Suggestion:** Make these schema fields conditionally required based on `event_type` (requires JSON Schema `if/then`). Low priority.

### P2.3 — No loading state during study config load

**Issue:** Page shows "Loading study..." during the brief params resolution. After study config loads, the page renders immediately. Acceptable for pilot.  
**Suggestion:** Add a proper loading spinner if desired.

### P2.4 — No npm run study:run script

**Issue:** The frozen spec lists `npm run study:run` but it's not implemented (currently `npm run dev` must be used directly). README documents `npm run dev`.  
**Suggestion:** Create the script alias for discoverability.

---

## Summary

| Priority | Count | Items |
|---|---|---|
| **P0 (fix before pilot)** | 4 | Empty demographics form, no attention check scenario, missing study_id validation, GLMM p-values |
| **P1 (risks to monitor)** | 5 | Refresh data loss, Prolific params unverified, join validation message, TSI default, column alignment |
| **P2 (defer)** | 4 | Event structure, placeholder values, loading state, npm script |

### Blocking status

⛔ **BLOCKED if:** You recruit participants before fixing P0.1 and P0.2.  
⛔ **BLOCKED if:** You deploy to Prolific without testing P1.2 (URL parameter names).  
✅ **ACCEPTABLE for pilot:** All P1 risks are manageable. P2 items are cosmetic.

The two blocking P0 items (empty demographics form + missing attention check) can be fixed in ~40 minutes.
