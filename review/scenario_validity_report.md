# Scenario Validity Report — Experimental Psychology Review

**File:** `C:\Users\gbx12\projects\interactionkit\data\scenarios\fitness.json` (10 scenarios)
**Method:** Per-scenario evaluation + cross-scenario psychometric analysis
**Standards:** CHI guidance on stimulus design for calibration experiments; HCI methodology best practices

---

## 1. Per-Scenario Evaluation

### Scoring

| Dimension | Scale | Operationalization |
|---|---|---|
| **Calibration pressure** | 1–5 | Does this scenario force a meaningful trust/distrust choice? High = participant must actively evaluate cues |
| **Confidence justification** | 1–5 | Is AI confidence level ecologically valid? |
| **Ceiling/floor risk** | 1–5 | High score = low risk (appropriate difficulty) |
| **Discriminability** | 1–5 | Does it probe a *different* calibration mechanism than other scenarios? |

---

### S1. squat-knee-pain (correct, confidence 82)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 2 | AI answer is appropriately cautious. Confidence (82) signals "high but not certain," which matches the answer structure. The conditional nature of the ground truth ("yes, but only if...") means multiple answers could be "correct." Weak calibration pressure because the AI is aligned with truth. |
| Confidence justification | 4 | Plausible for a cautious clinical answer. |
| Ceiling/floor risk | 5 (low risk) | Neither ceiling (unlikely to universally trust) nor floor (unlikely to universally distrust). But for the *wrong reasons* — personal experience variance, not evidence quality. |
| Discriminability | 2 | "Consult a professional" is a generic pattern. Participants who see this in multiple scenarios may develop a "when in doubt, trust" heuristic. |

**Validity rating:** BORDERLINE. Ground truth is conditional, making binary answer_accurate classification fragile (participant could be correct to trust AND correct to distrust, depending on their assumed pain type). Recommend: replace with unconditional ground truth scenario.

---

### S2. hamstring-stretch (correct, confidence 90)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 1 | Consensus knowledge: most active participants know not to static-stretch cold. No calibration pressure because v1 and v2 both succeed. |
| Confidence justification | 5 | Standard exercise physiology consensus. |
| Ceiling/floor risk | 1 (HIGH risk) | Universal trust. Zero variance. Contributes no information to the condition comparison. |
| Discriminability | 1 | The best-known fact in the set. Distinct from S7 and S10 (both also stretching-related) — but three stretching scenarios is two too many. |

**Validity rating:** INVALID. Ceiling effect makes it a waste of a trial. Reduces statistical power by occupying a slot that could be a discriminating trial. Recommend: remove and replace with a non-stretching correct scenario with moderate confidence (70–80%).

---

### S3. running-shoe-replacement (correct, confidence 88)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 2 | AI is correct on the mileage guideline (well-known). Minor disagreement on calendar-time metric is a weak manipulation. |
| Confidence justification | 4 | Plausible. |
| Ceiling/floor risk | 3 (moderate risk) | Non-runners lack the knowledge to evaluate (their trust depends on surface cues). This is actually *interesting for calibration* — it tests whether evidence provenance helps when the participant lacks domain knowledge. A redeeming feature. |
| Discriminability | 2 | Similar to S1 in structure: "AI is correct but not perfectly so." Two such scenarios is one too many. |

**Validity rating:** ACCEPTABLE WITH RESERVATION. Ceiling risk for runners; floor variance for non-runners is valuable but should be tracked with a familiarity covariate.

---

### S4. creatine-hair-loss (correct, confidence 85)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 4 | **Strong.** This is the rare correct-answer scenario where participants may be inclined to distrust (due to persistent social media myth). The AI must overcome prior belief. In v1, participants have only confidence (85) to override their prior. In v2, the evidence provenance (2009 DHT study ★2, JISSN review ★5) directly addresses why the myth is wrong. This is the **strongest test** of evidence provenance in the correct-answer condition. |
| Confidence justification | 5 | Well-calibrated to current consensus. |
| Ceiling/floor risk | 4 (low risk) | Variance driven by prior belief about creatine, not by evidence quality. This is acceptable (prior belief is a realistic covariate). |
| Discriminability | 5 | Unique in the set: the only scenario where participants' prior pulls *against* the correct answer. |

**Validity rating:** HIGH. Keep as is.

---

### S5. protein-timing (incorrect, confidence 75)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 3 | The 30-minute "anabolic window" is a persistent gym myth. confidence 75 is **too low** (AI doesn't sound confident enough). With higher confidence (85), this could be a strong dissociation trial. |
| Confidence justification | 2 | 75 is implausibly cautious for a gym myth that many influencers push with high certainty. The AI should be 80–85. |
| Ceiling/floor risk | 3 | Moderate — participants who lift know this is debatable; non-lifters lack the framework. |
| Discriminability | 3 | Good in content (protein timing is distinct from other topics), but the evidence quality (3/5/4 = mean 4.0) is not diagnostic. The calibrationExplanation mentions "early studies n=8-12 vs. recent reviews n=100+" — this would be a strong signal IF the evidenceSources reflected it, but they don't. |

**Validity rating:** ACCEPTABLE WITH FIXES. Raise confidence to 85; restructure evidenceSources to show the sample-size discrepancy (★2 for the early small studies, ★5 for large reviews).

---

### S6. vitamin-c-colds (incorrect, confidence 88)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 5 | **Excellent.** High confidence (88) + incorrect answer + widely known myth. The Cochrane review ★5 vs. early in-vitro studies ★2 in evidenceSources is a textbook diagnostic split. This is the **strongest dissociation trial** in the set. |
| Confidence justification | 5 | Many people believe vitamin C prevents colds. 88 is plausible. |
| Ceiling/floor risk | 5 (low risk) | Correct answer is counterintuitive (most people think vitamin C helps). Actual knowledge is bimodal — participants with medical/scientific training will know; others won't. |
| Discriminability | 5 | Unique topic. Distinct psychological mechanism (overgeneralization from in-vitro to human). The only trial where evidence quality is truly diagnostic. |

**Validity rating:** HIGH. The gold standard scenario in this set. Add one more like this.

---

### S7. stretching-injury-prevention (incorrect, confidence 86)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 4 | High confidence (86) + incorrect. A popular gym myth. Good dissociation trial. |
| Confidence justification | 4 | Plausible — many trainers and apps still recommend pre-workout static stretching. |
| Ceiling/floor risk | 4 (low risk) | Active exercisers may know static stretching isn't needed; sedentary participants won't. Variance is meaningful. |
| Discriminability | 1 | **Critical problem:** Structurally identical to S10 (post-workout-stretching). Both are stretching myths. Both are confidence-moderate-to-high + incorrect. A participant who understands one will likely understand the other. This creates scenario dependency, artificially reducing the effective number of independent trials. |

**Validity rating:** BORDERLINE. The content is valid, but the overlap with S10 is problematic. With S2 (stretching, correct) and S10 (stretching, incorrect), the set has three stretching scenarios (S2, S7, S10) occupying 30% of trials. This inflates the within-set correlation and reduces measurement breadth.

---

### S8. cardio-before-weights (incorrect, confidence 60)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 1 | confidence 60 signals uncertainty. Participants in v1 will be skeptical. The dissociation is too weak to measure. |
| Confidence justification | 1 | 60 is implausibly low. Many gym-goers actually believe cardio comes first. The AI should be 75–80. |
| Ceiling/floor risk | 1 (HIGH floor risk) | Low confidence → participants distrust regardless of evidence. |
| Discriminability | 3 | Content is distinct (exercise order). But the low confidence makes discriminability irrelevant — the floor effect swamps any content-based distinction. |

**Validity rating:** INVALID. confidence must be raised to ≥ 80 before this scenario can test the hypothesis. Evidence quality (★5/5/4) is also non-diagnostic (same as correct answers).

---

### S9. fasted-cardio (incorrect, confidence 72)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 2 | Confidence 72 signals uncertainty. Moderate dissociation only. |
| Confidence justification | 3 | Borderline — many fitness influencers push fasted cardio with absolute certainty, so 72 may be too cautious. Should be 78–82. |
| Ceiling/floor risk | 3 | Moderate. Active gym-goers may have an opinion; the general population finds it obscure. Obscurity reduces engagement. |
| Discriminability | 3 | Content is distinct (nutrition + exercise timing), but the low confidence and non-diagnostic evidence quality (★4/5/4 = mean 4.33) make it hard to interpret. |

**Validity rating:** ACCEPTABLE WITH FIXES. Raise confidence to 80; restructure evidenceSources to show acute (★3) vs. longitudinal (★5 — as "missing evidence that contradicts the claim").

---

### S10. post-workout-stretching (incorrect, confidence 78)

| Dimension | Score | Notes |
|---|---|---|
| Calibration pressure | 3 | confidence 78 is moderate. The lactic acid myth is widely believed, which creates some calibration pressure. |
| Confidence justification | 2 | 78 is too cautious — the lactic acid myth is taught in high school athletics. Many people believe it strongly. Should be 82–85. |
| Ceiling/floor risk | 3 | Moderate variance — depends on whether the participant has ever researched DOMS. |
| Discriminability | 2 | Stretching content overlaps with S7 and S2. The psychological mechanism (belief in a debunked physiological mechanism, lactic acid) is *distinct* from S7 (belief in injury prevention) and S2 (dynamic vs static). But the surface similarity is high — participants may pattern-match rather than engage each trial independently. |

**Validity rating:** ACCEPTABLE. The lactic-acid mechanism is distinct from static-stretching-injury-prevention (S7). But with S2, S7, and S10 all touching stretching, the scenario family is overrepresented. Keep if S2 is removed and S7 is replaced with a non-stretching topic.

---

## 2. Cross-Scenario Psychometric Analysis

### 2.1 Thematic Clusters

| Cluster | Scenarios | Count | Problem |
|---|---|---|---|
| Stretching/warm-up | S2 (correct), S7 (incorrect), S10 (incorrect) | 3 | Overrepresented. Three scenarios testing the same construct domain. S2 is ceiling (zero variance). |
| General fitness myths | S5 (protein), S8 (cardio order), S9 (fasted cardio) | 3 | Underpowered on confidence — all three have confidence ≤ 75. |
| Nutrition/supplements | S3 (shoes — weak), S4 (creatine), S5 (protein), S6 (vitamin C), S9 (fasted cardio) | 5 | Bready. Needs more focus. |
| Clinical/conditional | S1 (knee pain) | 1 | Ground truth ambiguity problem. |

### 2.2 Balance

| Status | Count | Scenario IDs |
|---|---|---|
| answerAccurate = true | 4 | S1, S2, S3, S4 |
| answerAccurate = false | 6 | S5, S6, S7, S8, S9, S10 |

Ratio: 4:6 (0.67). Not catastrophic but systematically tilts Brier in favor of skeptical participants.

### 2.3 Confidence × Accuracy Dissociation Matrix

| | correct | incorrect | Δ |
|---|---|---|---|
| Mean confidence | 86.25 | 76.50 | 9.75 |

Confidence discriminates accuracy across the set. But within the *incorrect* set, confidence is negatively associated with calibration value:

| | High confidence (≥ 80), incorrect | Moderate confidence (< 80), incorrect |
|---|---|---|
| Count | 2 (S6: 88, S7: 86) | 4 (S5: 75, S8: 60, S9: 72, S10: 78) |

The dissociation trials (high confidence + wrong) are outnumbered 2:1 by moderate-confidence trials. The effects will be concentrated in S6 and S7. If you accept a scenario set where only 2/10 trials carry the critical signal, the effective trial count for the primary analysis drops from 10 to 2, drastically reducing power.

### 2.4 Evidence Quality × Accuracy Relationship

| Correct scenarios | Mean evidence quality | Incorrect scenarios | Mean evidence quality |
|---|---|---|---|
| S1 | 4.67 | S5 | 4.00 |
| S2 | 4.67 | S6 | **3.00** |
| S3 | 4.33 | S7 | 3.67 |
| S4 | 4.00 | S8 | 4.67 |
| | | S9 | 4.33 |
| | | S10 | 4.67 |
| **Mean** | **4.42** | **Mean** | **4.06** |

Overlap is severe. Only S6 (vitamin C) has genuinely diagnostic evidence quality (★5/2/2 = mean 3.00). S8, S9, S10 have evidence quality ≥ 4.33 — indistinguishable from correct scenarios.

### 2.5 Internal Consistency Risk

With only 2 high-dissociation trials (S6, S7), expected Cronbach's α for the condition effect will be low (< 0.40). This means the Brier difference between conditions will be noisy, requiring larger N.

---

## 3. Recommended Scenario Revisions

### 3.1 Replace S2 (hamstring-stretch, correct, 90)

Replace with a correct-answer scenario with LOW confidence (60–70%), testing whether evidence provenance helps participants trust a hesitant-but-correct AI:

> **Question:** Does creatine work for older adults?  
> **AI answer:** No, creatine is only effective for younger athletes...  
> **Ground truth:** Creatine is effective for adults of all ages for strength gains.  
> **answerAccurate:** false (AI is wrong)  
> **AI confidence:** 65  
> **Evidence quality:** should show that the "age-limited effectiveness" claim comes from one association study (★2) while large RCTs show benefits across age groups (★5)

Wait, that changes the answer accuracy. Let me think of a better one.

Actually, replace S2 with:

> **Question:** Is walking as effective as running for cardiovascular health?  
> **AI answer:** No, walking doesn't raise your heart rate enough to count as cardio. Only running provides meaningful cardiovascular benefits.  
> **Ground truth:** Brisk walking provides significant cardiovascular benefits comparable to running when total energy expenditure is matched.  
> **answerAccurate:** false (AI is wrong)  
> **AI confidence:** 82  
> **Evidence:** walking studies ★5, running comparison studies ★5, early assumptions ★2

Hmm, this is also nice but changes correct/incorrect balance to 3:7.

Let me think differently. The 4:6 imbalance is a concern. Let me add one correct scenario to make it 5:5, and remove S2 (ceiling).

Replace S2 with a correct answer plus a scenario where the AI has MODERATE confidence (65-75%) but is correct: 

> **Question:** Should you exercise when you have a mild cold?  
> **AI answer:** Light to moderate exercise is generally safe if symptoms are above the neck (runny nose, sore throat). Avoid exercise if you have chest congestion, fever, or body aches.  
> **Ground truth:** "Above the neck" rule is the standard medical guideline.  
> **answerAccurate:** true  
> **AI confidence:** 68  
> **Evidence quality:** good (medical consensus)

This gives us: moderate confidence + correct = test of whether evidence provenance reduces under-trust of a hesitant AI. Balance becomes 5:5.

### 3.2 Raise confidence of S5, S8, S9, S10

| Scenario | Current | Target | Rationale |
|---|---|---|---|
| S5 (protein-timing) | 75 | 84 | Popular myth |
| S8 (cardio-before-weights) | 60 | 78 | Moderate increase — some nuance here |
| S9 (fasted-cardio) | 72 | 82 | Widely promoted |
| S10 (post-workout-stretching) | 78 | 84 | Persistently taught myth |

### 3.3 Fix evidence quality of S8, S9, S10

Restructure evidenceSources to make quality diagnostic:

**S8 (cardio-before-weights):** Current ★5/5/4 → Replace top two sources with lower quality:
- ★2: "A personal trainer blog post recommending cardio first"
- ★3: "A 2005 observational study of gym exercise order"
- Keep ★5 for the meta-analysis showing cardio pre-fatigue reduces strength

**S9 (fasted-cardio):** Current ★4/5/4 → Restructure:
- ★3: "Acute metabolism study showing higher fat oxidation during fasted cardio"
- ★5: "Longitudinal RCT showing no difference in 12-week fat loss" — but mark as conflicting
- ★4: "Review paper on nutrient timing"

**S10 (post-workout-stretching):** Current ★5/4/5 → Restructure:
- The Cochrane Review ★5 → move to calibrationExplanation, not evidenceSources
- ★2: "Early muscle soreness studies (pre-2000, poor methodology)"
- ★2: "Lactic acid clearance study (debunked mechanism)"
- ★5: Keep only if marked as "Cochrane review finding: no DOMS reduction"

---

## 4. Summary

| Scenario | Current validity | Required action |
|---|---|---|
| S1 squat-knee-pain | Borderline | Replace with unambiguous ground truth |
| S2 hamstring-stretch | **INVALID** (ceiling) | Replace |
| S3 running-shoe-replacement | Acceptable | Keep |
| S4 creatine-hair-loss | HIGH | Keep |
| S5 protein-timing | Acceptable with fixes | Raise confidence to 84 |
| S6 vitamin-c-colds | HIGH (best in set) | Keep |
| S7 stretching-injury | Borderline (overlap) | Replace with non-stretching topic |
| S8 cardio-before-weights | **INVALID** (confidence too low) | Raise to 78, fix evidence quality |
| S9 fasted-cardio | Acceptable with fixes | Raise to 82, fix evidence quality |
| S10 post-workout-stretching | Acceptable with fixes | Raise to 84, fix evidence quality |

**Revised balance after recommended changes:**
- 5 correct, 5 incorrect (was 4:6)
- 4 high-dissociation trials (confidence ≥ 80 + incorrect) (was 2)
- 2 medium-dissociation trials (confidence 70-80 + incorrect) (was 4)
- 1 low-confidence correct trial (new)
- 0 ceiling-effect scenarios (was 1)
- Mean evidence quality gap: correct 4.42 → target ≥ 1.5 gap (was 0.36)

**Critical gap:** The set still lacks a scenario that tests whether evidence provenance helps when confidence is low but the AI is correct. Adding S11 (exercise with mild cold, 68%) would fill this gap and bring balance to 5:5 while providing a third type of calibration pressure: "moderate evidence + moderate confidence + correct → does evidence promote appropriate trust?"
