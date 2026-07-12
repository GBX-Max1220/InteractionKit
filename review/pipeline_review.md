# Full Pipeline Review — InteractionKit Analysis

**Files reviewed:**
- `analysis/compute-brier.R` (v1)
- `schemas/log-event.schema.json` (v0.3.0)
- `data/scenarios/fitness.json` (10 scenarios)

---

## 1. Correctness

### Brier Score Computation

**Formula in R:** `(probability_prediction - as.numeric(answer_accurate)) ^ 2`

Correct. Brier = (predicted_probability - actual_outcome)^2. `probability_prediction` is in [0,1], `answer_accurate` is boolean (TRUE → 1, FALSE → 0). The formula is the standard Brier definition.

### Over-trust / Under-trust Definitions

**R code:**
```r
overtrust  <- decision == "trust"   & !answer_accurate
undertrust <- decision == "distrust" &  answer_accurate
```

**Problem:** "unsure" is treated as neither over-trust nor under-trust (both booleans are FALSE). This is a defensible default, but the R script does not log the rate of "unsure" responses or flag it as a methodological decision. A CHI reviewer will ask: "How many trials were excluded from the over-trust analysis due to 'unsure' responses? Was the exclusion rate balanced across conditions?"

**Verdict:** Functionally correct. Documentation gap.

### Scenario Joining

**R code:**
```r
scenario_lookup <- list()
for (s in scenarios$scenarios) {
  scenario_lookup[[s$id]] <- s$answerAccurate
}
...
decisions$answer_accurate <- sapply(decisions$scenario_id, function(id) {
  scenario_lookup[[id]]
})
```

**Problem:** If a `scenario_id` in the CSV does not exist in the JSON, `scenario_lookup[[id]]` returns NULL. `as.numeric(NULL)` returns `numeric(0)`. `numeric(0) ^ 2` returns `numeric(0)`. The Brier score column will have `numeric(0)` values for that row. `aggregate()` silently drops NULL rows; `lmer()` may error. The join is not validated — no assertion that every scenario_id was found.

**Additionally:** `s$answerAccurate` is loaded from JSON by `jsonlite::fromJSON()`. In the fitness.json, `answerAccurate` is a JSON boolean (`true`/`false`). `jsonlite` parses these as R logical (TRUE/FALSE). `as.logical(scenario_lookup[[id]])` is therefore redundant but harmless. However, if the JSON contains strings ("true"/"false") instead of booleans, `as.logical()` behaves differently: `as.logical("true")` → NA (with warning). The script would silently produce NAs.

**Verdict:** Validated joins are missing. Silent failure on unmatched scenario_id or mis-typed boolean values.

---

## 2. Reproducibility

### Can another lab reproduce the exact same metrics?

**Yes, if they use the same CSV schema + scenario JSON.** The Brier formula is deterministic. The over-trust/under-trust definitions are deterministic. The mixed model using the same formula will produce the same coefficients.

**But three hidden assumptions prevent exact reproduction:**

**2a. Preprocessing is assumed, not scripted.** The R script filters to `event_type == "decision"` and then computes metrics. It does not apply the pre-registered exclusion criteria (attention check, < 6 scenarios, < 20 seconds). There is no flag for these in the schema. A reproducing lab would need to know the exclusion rules from the paper, not the code.

**2b. `study_id` is in the schema but not used.** The schema includes `study_id` with enum values `["interactionkit", "independent-implementation"]`. The R script ignores it entirely. When Study 2 (independent reconstruction) data arrives, the current script will pool it with Study 1 data without any identifier, making pooled analysis impossible.

**2c. No ML library version pinning.** The script uses `lme4::lmer()`. Different lme4 versions (1.1-35 vs. 1.1-33) can produce different REML estimates for small samples. The analysis is not containerized or version-pinned.

### What would break reproducibility?

- A different JSON library that parses booleans as strings (Python `json.loads(s)` → `True`/`False`, R `jsonlite::fromJSON` → `TRUE`/`FALSE`, but `readr::parse_logical("true")` → NA). The R script relies on `jsonlite` conventions.
- A CSV that uses 0/1 instead of true/false for `answer_accurate` (the R script uses `as.numeric(TRUE)` → 1, `as.numeric(FALSE)` → 0. If the CSV stores 0/1, `as.numeric()` still works. Safe.)
- A CSV that stores `decision_time_ms` as a string (R `read.csv` will import as character, `lmer` will coerce to numeric with warning. If coercion fails, the model errors.)

---

## 3. Statistical Validity

### Bias in Metrics

**3a. Accuracy imbalance: 4 correct + 6 incorrect = 10.**

| | Count |
|---|---|
| answerAccurate = true | 4 |
| answerAccurate = false | 6 |

Participants who are skeptical by default (probability_prediction consistently < 0.5) will have better Brier scores by chance than participants who are trusting by default, because the scenario set tilts towards incorrect answers. The bias is small but systematic:

- A participant who always says p = 0.4: Brier = (0.4-0)^2 × 6 + (0.4-1)^2 × 4 = 0.16 × 6 + 0.36 × 4 = 0.96 + 1.44 = 2.40 / 10 = **0.240**
- A participant who always says p = 0.6: Brier = (0.6-0)^2 × 6 + (0.6-1)^2 × 4 = 0.36 × 6 + 0.16 × 4 = 2.16 + 0.64 = 2.80 / 10 = **0.280**

A 0.28 Brier vs. 0.24 Brier due to response bias, not calibration quality. This is a small bias (0.04) but could be comparable to the expected effect size (d ≈ 0.30–0.35 corresponds to approximately 0.03–0.04 Brier difference).

**Impact on the hypothesis test:** If v2 participants are more skeptical (more likely to say low probability), they will get better Brier scores mechanically. This could produce a spurious "improvement" that is actually just a shift in response distribution, not calibration quality.

**Fix:** Balance to 5 correct + 5 incorrect, OR normalize Brier by the marginal prevalence: compute Brier separately for correct and incorrect trials, then average. (In the mixed model, include `answer_accurate` as a covariate or interaction term.)

**3b. Confidence-accuracy relationship in the AI responses.**

| | Mean AI confidence |
|---|---|
| Correct answers (n=4) | 86.25 |
| Incorrect answers (n=6) | 68.00 |

The AI is well-calibrated — higher confidence when correct, lower when incorrect. This means in v1 (confidence only), participants already have a useful signal. The dissociation trials where confidence and evidence diverge are critical for detecting an evidence-provenance effect.

Checking the specifics:

| Scenario | answerAccurate | AI confidence | Evidence quality | Dissociation? |
|---|---|---|---|---|
| protein-timing | false | 75 | Mixed (3, 5, 4) | Weak — confidence is moderate |
| ice-bath-recovery | false | 68 | High (5, 5, 4) | Weak — confidence is moderate, evidence is high |
| cardio-before-weights | false | 60 | High (5, 5, 4) | Weak — confidence is low, evidence is high |
| fasted-cardio | false | 72 | High (4, 5, 4) | Weak — confidence is moderate, evidence is high |
| post-workout-stretching | false | 78 | High (5, 4, 5) | Weak — confidence is moderate, evidence is high |

**There is no high-confidence + weak-evidence scenario.** The highest confidence for an incorrect answer is 78 (post-workout-stretching). The critical dissociation — a confident AI that is wrong, where only evidence provenance reveals the weakness — does not exist in this scenario set.

This means the central test of the Evidence Provenance Card hypothesis is not testable with this scenario set.

**3c. "Unsure" rate unknown.**

The schema stores `decision` with values "trust", "distrust", "unsure". The R script excludes "unsure" from over-trust/under-trust (both booleans become FALSE). But:

- If the "unsure" rate is high (> 10%), the over-trust/under-trust analysis loses power.
- If the "unsure" rate differs by condition (e.g., v2 participants are more "unsure"), the over-trust comparison is confounded.
- The R script logs none of this.

### Edge Cases

1. **Participant always says "unsure"** → over-trust rate = under-trust rate = 0%. Included in Brier analysis (probability_prediction = 50% default? Or missing?). If the slider has no default (as recommended in the methods review), this participant contributes no data. If the slider defaults to 50%, this participant contributes Brier = 0.25 per trial, which looks like moderate calibration.

2. **Participant always says "trust"** → over-trust rate = 60% (6/10). Not excluded by any criterion. High over-trust ≠ low data quality — it could be genuine extreme trust. The sensitivity analysis (recommended in the methods review) handles this.

3. **Missing `probability_prediction`** → Brier cannot be computed. The R script errors on `NA ^ 2` (returns NA). `aggregate(..., FUN = mean)` with NAs returns NA unless `na.rm = TRUE`. The current script does not set `na.rm = TRUE`, so if any trial has missing `probability_prediction`, aggregate returns NA for that condition.

### Missing Preprocessing

| Step | Current status | Needed |
|---|---|---|
| Exclusion criteria application | Not implemented | Filter out participants meeting exclusion criteria BEFORE any metric computation |
| Attention check flag | Not in schema | Add `attention_check_passed` field |
| Familiarity covariate | Not in schema | Add per-scenario familiarity (1-7) |
| Page refresh detection | Not in schema | Add `page_refresh_count` field |
| Unsure rate logging | Not in R script | Log and report before over-trust computation |

---

## 4. Future Analysis Compatibility

### Mixed-Effects Models

The current pipeline has the right foundation but needs three changes:

**4a. Scenario random intercept is missing.**
```r
# Current:
lmer(brier_score ~ condition + (1 | participant_id), data = decisions)
# Required:
lmer(brier_score ~ condition + (1 | participant_id) + (1 | scenario_id), data = decisions)
```

**4b. Mixed model for over-trust uses the wrong family.**
```r
# Current: lm/aggregate approach for binary outcome
# Required:
glmer(overtrust ~ condition + (1 | participant_id) + (1 | scenario_id),
      family = binomial, data = decisions)
```

Over-trust is binary (TRUE/FALSE per trial). A linear model is inappropriate. A generalized linear mixed model (GLMM) with binomial link is required.

**4c. Pooled analysis script does not exist.**
The `analysis/` directory should contain a second script `analysis/pooled-analysis.R` that:
- Reads Study 1 and Study 2 CSV files
- Computes Brier for both with the same formula
- Tests `brier ~ condition * study + (1 | participant_id) + (1 | scenario_id)`
- Reports the condition × study interaction

### Variables to Add Before Pilot

| Variable | Location | Reason |
|---|---|---|
| `familiarity` | Per-scenario, in CSV schema and scenario JSON | Covariate for primary analysis (methods review B3) |
| `answer_accurate` | Pre-computed in CSV (currently joined at analysis time) | Would make analysis simpler and avoid join failures |
| `study_id` | Already in schema, populate at export | Required for pooled analysis |
| `attention_check_passed` | New field, boolean | Pre-registered exclusion criterion |
| `page_refresh_count` | New field, integer | Detect data quality issues |

---

## 5. CHI Reviewer Attack Points (Ranked by Likelihood)

Here is every methodological weakness I would attack as a reviewer of this paper.

### Attack 1 (Certain to be raised — HIGH severity)

> **"The scenarios are imbalanced (4 correct, 6 incorrect), and there is no high-confidence wrong-answer trial. The central test of the Evidence Provenance Card hypothesis — that evidence provenance helps when confidence is misleading — is not testable with this scenario set."**

This is the strongest attack. The claim is that evidence provenance improves calibration by helping users override misleading confidence cues. But in this dataset, the AI is well-calibrated (mean confidence: correct = 86, incorrect = 68). When the AI is wrong, its confidence is moderate (max 78). Participants in v1 can already detect low confidence and adjust. The incremental value of evidence provenance is therefore small to nonexistent, and the scenario set does not allow detecting it.

**Recommended response in paper:** Acknowledge the limitation explicitly. Frame the study as a conservative test: if evidence provenance improves calibration even with a moderately well-calibrated AI, the effect should be larger with a poorly calibrated AI. Include a scenario-level analysis showing the effect in individual scenarios.

### Attack 2 (Very likely — HIGH severity)

> **"No domain knowledge covariate. The condition effect could be driven by pre-existing fitness knowledge, not the evidence manipulation."**

Without per-scenario familiarity, a reviewer has no way to evaluate whether v1 and v2 participants were matched on domain knowledge. Random assignment should balance this, but with N = 60–100 per condition, imbalance is possible.

**Fix before pilot:** Add `familiarity` to the schema, collect it per scenario, include it as a covariate.

### Attack 3 (Likely — MEDIUM severity)

> **"The API/schema is the contribution, but the analysis pipeline has unresolved methodological issues: missing scenario random intercept, trial-level aggregation, binary outcomes modeled with linear family."**

These are easy fixes (all identified in this review). If fixed before submission, this attack disappears. If not fixed, a reviewer will note that the platform for "comparable" data uses non-comparable statistics.

### Attack 4 (Likely — MEDIUM severity)

> **"Over-trust/under-trust excludes 'unsure' responses without reporting the exclusion rate. If the rates differ by condition, the comparison is confounded."**

The R script must log and report the "unsure" rate per condition before computing over-trust rates.

### Attack 5 (Possible — MEDIUM severity)

> **"No exclusion criteria in the analysis script. You pre-registered exclusions but the code doesn't apply them. How do we know the reported results reflect the pre-registered plan?"**

The R script should apply exclusions before computing anything. Currently it reads all data without filtering.

### Attack 6 (Possible — LOW-MEDIUM severity)

> **"Brier score is biased by the accuracy imbalance (4 correct, 6 incorrect). A skeptical participant has a lower Brier by chance."**

The bias is ~0.04 Brier, which is comparable to a small-to-medium effect size. Include `answer_accurate` as a fixed effect in the model (`brier ~ condition * answer_accurate + ...`).

### Attack 7 (Unlikely but notable — LOW severity)

> **"The TSI mean is pre-computed in the client and stored in the schema. This introduces the same operationalization problem InteractionKit claims to solve — different clients may compute means differently (e.g., rounding, handling missing items)."**

This is ironic. Fix: remove `tsi_mean` from the schema, compute it in the analysis script from the 12 individual items.

---

## Summary Table

| Area | Issue | Severity | Fix |
|---|---|---|---|
| Schema | Missing `familiarity` field | HIGH | Add per-scenario covariate |
| Schema | Missing `attention_check_passed` field | MEDIUM | Add for exclusion tracking |
| Schema | `tsi_mean` pre-computed | LOW | Remove, compute in analysis |
| Scenarios | 4 correct / 6 incorrect imbalance | MEDIUM | Balance to 5/5 or include `answer_accurate` as covariate |
| Scenarios | No high-confidence wrong-answer trial | HIGH | Redesign 2 scenarios |
| R script | Missing scenario random intercept | HIGH | `+ (1 \| scenario_id)` |
| R script | lmerTest not loaded | HIGH | `library(lmerTest)` |
| R script | Trial-level aggregation | HIGH | Participant-level means first |
| R script | No exclusion criteria applied | MEDIUM | Filter before analysis |
| R script | `study_id` not used | MEDIUM | Add to pooled analysis script |
| R script | Over-trust uses linear family | MEDIUM | `glmer(binomial)` |
| R script | No "unsure" rate reporting | LOW | Log before over-trust computation |
| R script | No validation of scenario join | HIGH | Assert all scenario_ids found |

**Bottom line:** The pipeline has a coherent foundation but three design-level issues (scenario imbalance, missing dissociation trials, missing familiarity covariate) are not fixes — they require scenario re-design and schema updates before piloting. The R script issues are all mechanical and fixable in < 1 hour.
