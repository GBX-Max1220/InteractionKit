# Pre-Registration: Evidence-Provenance-Augmented Confidence and Trust Calibration

**Registry:** OSF (to be registered)  
**Date:** 2026-07-12  
**Version:** 1.0  

---

## 1. Research Questions

**RQ1 (Primary):** Does augmenting AI confidence communication with evidence provenance information improve trust calibration, measured by Brier score, compared to confidence-only communication?

**RQ2 (Secondary):** Does evidence-provenance-augmented confidence reduce over-trust (trusting incorrect AI answers) and under-trust (distrusting correct AI answers) compared to confidence-only communication?

**RQ3 (Secondary):** Does evidence-provenance-augmented confidence affect decision time compared to confidence-only communication?

---

## 2. Hypotheses

**H1 (Primary):** Participants in the evidence-provenance-augmented condition (v2) will have significantly lower (better) mean Brier scores compared to participants in the confidence-only condition (v1), controlling for scenario accuracy and participant-level random variation.

**H2a (Secondary):** Participants in the v2 condition will show a lower over-trust rate (proportion of trials where an incorrect AI answer is trusted) compared to v1.

**H2b (Secondary):** Participants in the v2 condition will show a lower under-trust rate (proportion of trials where a correct AI answer is distrusted) compared to v1.

**H3 (Secondary):** Participants in the v2 condition will show longer mean decision times compared to v1, reflecting more careful processing of evidence information.

---

## 3. Experimental Design

| Dimension | Specification |
|---|---|
| Design type | Between-subjects, two conditions |
| Independent variable | Confidence communication format |
| Conditions | v1 (confidence only), v2 (evidence-provenance-augmented) |
| Assignment | Random (50/50 via Math.random()) |
| Trial structure | 10 within-subject scenarios, randomized order per participant |
| Total N | To be determined via pilot-then-power-analysis (Section 10) |
| Recruitment | Prolific (general population, no fitness knowledge screening) |
| Estimated duration | 10–15 minutes |
| Compensation | Prolific standard rate (~£9-12/hr equivalent) |

### Trial Flow (per scenario)

```
1. Show question + AI answer text
2. Show confidence information (v1: numeric % / v2: % + evidence sources + quality + explanation)
   ─── timer starts ───
3. Collect probability estimate (0–100% slider, must be interacted)
4. Collect trust decision (Trust / Don't Trust / Unsure)
   ─── timer stops ───
5. Reveal ground truth + calibration feedback
6. Collect familiarity rating (1–7)
```

### Conditions

**v1 (Confidence Only):**
- AI answer text
- "AI Confidence: X%" (numeric percentage)
- No additional information

**v2 (Evidence-Provenance-Augmented):**
- AI answer text
- "AI Confidence: X%" (numeric percentage)
- Calibration explanation (1-2 sentences explaining why the AI has this confidence level)
- Evidence sources list with star ratings (1-5)
- The intervention is framed as a composite treatment — confidence plus evidence provenance

---

## 4. Independent Variables

| Variable | Type | Levels / Values |
|---|---|---|
| Condition | Between-subjects, categorical | v1 (confidence only), v2 (evidence-augmented) |
| Scenario ID | Within-subject, categorical (10 levels) | See Section 4a |
| Answer accuracy | Within-subject, binary | Correct (true), Incorrect (false) |
| Trial index | Within-subject, continuous (0–9) | Presentation order (randomized) |

### 4a. Scenario Set

10 fitness Q&A scenarios. 4 correct AI answers, 6 incorrect AI answers. AI confidence ranges from 55% to 90%. Two scenarios test the critical dissociation (high AI confidence ≥ 85% + incorrect answer + weak/mixed evidence).

| Scenario | answerAccurate | AI Confidence | Evidence Quality |
|---|---|---|---|
| squat-knee-pain | Correct | 82% | Strong |
| hamstring-stretch | Correct | 90% | Strong |
| protein-timing | Incorrect | 75% | Mixed |
| running-shoe-replacement | Correct | 88% | Strong |
| creatine-hair-loss | Correct | 85% | Mixed |
| vitamin-c-colds | Incorrect | 88% | Weak |
| stretching-injury-prevention | Incorrect | 86% | Weak |
| cardio-before-weights | Incorrect | 60% | Strong |
| fasted-cardio | Incorrect | 72% | Strong |
| post-workout-stretching | Incorrect | 78% | Strong |

---

## 5. Dependent Variables

### 5a. Primary Outcome

**Brier Score** — computed per trial as:

```
Brier = (probability_prediction - answer_accurate)^2
```

where `probability_prediction` is the participant's slider response normalized to [0, 1] and `answer_accurate` is 1 if the AI answer matches ground truth, 0 otherwise.

Lower Brier scores indicate better calibration.

### 5b. Secondary Outcomes

| Outcome | Definition | Analysis |
|---|---|---|
| Over-trust rate | Proportion of trials where decision = "trust" AND answer_accurate = FALSE | GLMM, binomial family |
| Under-trust rate | Proportion of trials where decision = "distrust" AND answer_accurate = TRUE | GLMM, binomial family |
| Decision time | Milliseconds from confidence display to trust decision submission | LMM, log-transformed if skewed |

### 5c. Covariates

| Covariate | Type | Source |
|---|---|---|
| Scenario familiarity | Integer (1–7) | Per-trial self-report after ground truth reveal |
| Answer accuracy | Binary (correct/incorrect) | Resolved from scenario data via scenario_id join |

---

## 6. Primary Analysis Model

### 6a. Primary Model

```r
lmer(brier_score ~ condition + answer_accurate + (1 | participant_id), data = decisions)
```

- `condition`: fixed effect of interest (v1 vs v2)
- `answer_accurate`: fixed effect covariate (accounts for 4/6 scenario imbalance)
- `(1 | participant_id)`: random intercept for repeated measures

The coefficient for `condition` tests H1. A negative coefficient indicates v2 has lower (better) Brier scores.

### 6b. Sensitivity Model (Scenario as Fixed Effect)

```r
lmer(brier_score ~ condition + answer_accurate + scenario_id + (1 | participant_id), data = decisions)
```

Included as sensitivity analysis. Reports whether the condition effect changes when scenario-level variance is accounted for as a fixed effect.

### 6c. Model with Familiarity Covariate

```r
lmer(brier_score ~ condition + answer_accurate + familiarity + (1 | participant_id), data = decisions)
```

Included as sensitivity analysis to test whether the condition effect is robust to controlling for prior domain knowledge.

---

## 7. Secondary Analysis Models

### 7a. Over-trust and Under-trust (GLMM)

```r
glmer(overtrust ~ condition + (1 | participant_id), family = binomial, data = decisions)
glmer(undertrust ~ condition + (1 | participant_id), family = binomial, data = decisions)
```

"Unsure" trials are excluded from over-trust and under-trust analysis. The exclusion rate per condition is reported.

### 7b. Decision Time (LMM)

```r
lmer(decision_time_ms ~ condition + (1 | participant_id), data = decisions)
```

---

## 8. Exclusion Criteria

Participants meeting any of the following criteria will be excluded from all analyses:

| Criterion | Threshold | Rationale |
|---|---|---|
| Attention check failed | Did not select "Trust" for the dedicated attention check trial | Ensures participant engagement |
| Insufficient completion | Fewer than 6 of 10 scenarios completed | Minimum data for within-subject variance estimation |
| Suspiciously fast completion | Total session time < 20 seconds (from session_start to session_complete) | Indicates automated bot or random clicking |

Excluded participants are documented with reason. Exclusion counts are reported per condition.

### Sensitivity Analysis (Not Exclusion)

The following are flagged and analyzed separately, not excluded:

- Same decision for all 10 scenarios (e.g., 10/10 "Trust")
- Self-reported AI familiarity ≥ 7 (ceiling on AI expertise)
- All familiarity ratings ≥ 6 (ceiling on domain knowledge)

---

## 9. Missing Data Handling

All core fields in the CSV schema are required. The following rules apply:

| Field | Handling |
|---|---|
| `probability_prediction` | Required. If missing, the trial is excluded from Brier computation. Count reported. |
| `decision` | Required. "Unsure" is a valid response; excluded from over-trust/under-trust but included in Brier. |
| `familiarity` | Optional. If missing, the trial is included in the primary model but excluded from the familiarity-covariate sensitivity model. |
| `decision_time_ms` | If zero or negative (timer error), the trial is excluded from decision-time analysis only. |

No imputation is performed. All exclusions are reported with counts.

---

## 10. Sample Size Determination

Sample size is not frozen at pre-registration. The following sequential procedure is used:

### Phase 1: Pilot (N = 20–40)

1. Recruit N = 10–20 per condition (20–40 total) via Prolific
2. Compute observed effect size (Cohen's d) for the condition effect on Brier score
3. Compute variance components (participant-level ICC, scenario-level variance)
4. Conduct power simulation using `simr` package in R with 1000 simulations per candidate N

### Phase 2: Power Analysis

Target: 80% power at α = 0.05 (two-sided) for the condition fixed effect in the primary mixed model.

Candidate sample sizes are evaluated from N = 60 to N = 200 per condition in increments of 20. The minimum N achieving ≥ 80% power is selected.

### Phase 3: Registration

The final target N is registered as an update to this pre-registration before Phase 4 recruitment begins.

### Phase 4: Full Study

Recruit to the determined N. The pilot sample is included in the final analysis (adding a fixed `phase` effect if pilot vs full-study differences are detected).

### Budget Constraint

Maximum feasible N is 200 per condition (400 total, ~$1,000 at $2.50/participant). If power analysis indicates N > 200 is required, this is reported as a limitation.

---

## 11. Exploratory Analyses

The following analyses are exploratory. Results are reported as such and are not used for hypothesis testing:

1. **Condition × Scenario interaction** — tests whether the evidence-provenance effect varies across scenarios (e.g., is larger for high-confidence/incorrect scenarios)
2. **Trial index × Condition interaction** — tests whether the condition effect grows or shrinks over the session (learning or fatigue effects)
3. **Familiarity × Condition interaction** — tests whether the evidence-provenance effect depends on prior domain knowledge
4. **Unsure rate by condition** — tests whether v2 participants are more or less likely to select "unsure"
5. **Per-scenario Brier score plots** — descriptive visualization of calibration by scenario and condition
6. **TSI (Trust in Automation Scale) by condition** — descriptive comparison of post-experiment trust ratings
7. **Decision time × condition × scenario accuracy** — exploratory model of processing time

---

## 12. Analysis Software

| Tool | Version (minimum) | Package |
|---|---|---|
| R | ≥ 4.2 | — |
| lmerTest | ≥ 3.1 | Mixed models with p-values |
| lme4 | ≥ 1.1 | GLMM for binary outcomes |
| jsonlite | ≥ 1.8 | JSON parsing for scenario data |

Analysis script: `analysis/compute-brier.R`

---

## 13. Departures from Pre-Registration

Any departures from this pre-registered plan (e.g., changes to exclusion criteria, analysis models, or outcome definitions) will be documented with:
1. The original specification
2. The reason for departure
3. The new specification
4. The impact on results

All departures will be reported in the paper.
