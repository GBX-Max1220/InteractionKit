# Consolidated Pre-Pilot Action Plan

**Inputs:** Hermes scenario domain review, Hermes power analysis review, Reasonix reproducibility review, self-piloted PILOT_READINESS_REVIEW.md  
**Status:** ⛔ Not pilot-ready until P0 items are resolved

---

## Part 1 — New Findings from Scenario Domain Review

### Finding S1: Evidence quality is not diagnostic (ACCEPT)

**Claim:** Mean evidence quality for correct scenarios (4.42) is nearly identical to incorrect scenarios (4.06 excluding vitamin-c). v2 participants see ★5 evidence for wrong answers — they are being misled, not helped.

**Verdict: ACCEPT.** This is the single most important methodological finding from all reviews. The experiment's core hypothesis depends on evidence quality being a *diagnostic signal* that helps v2 participants distinguish correct from incorrect answers. Currently it is not.

**Affected scenarios:**

| Scenario | Current evidence quality | Problem |
|---|---|---|
| cardio-before-weights (#8) | ★5/5/4 = 4.67 | Wrong answer but ★5 evidence |
| fasted-cardio (#9) | ★4/5/4 = 4.33 | Wrong answer but ★5 evidence |
| post-workout-stretching (#10) | ★5/4/5 = 4.67 | Wrong answer but ★5 evidence |

**Fix:** Replace high-quality sources for these 3 incorrect scenarios with lower-quality sources (★1-3). Move the actual high-quality evidence (Cochrane reviews, meta-analyses) into `calibrationExplanation` text but NOT into `evidenceSources` array. This makes the v2 evidence display diagnostic.

### Finding S2: Raise confidence on 3 incorrect scenarios (ACCEPT)

**Claim:** 3 incorrect scenarios have confidence too low for v1 participants to be misled.

| Scenario | Current | Suggested |
|---|---|---|
| protein-timing | 75 → 85 | Popular fitness myth |
| fasted-cardio | 72 → 82 | Widely promoted |
| post-workout-stretching | 78 → 85 | Ubiquitous myth |

**Verdict: ACCEPT.** Higher confidence means v1 participants trust more (over-trust), giving v2's evidence display room to correct. These are 5-minute number changes in the JSON.

### Finding S3: 5:5 balance (REJECT)

**Claim:** Change from 4:6 to 5:5 by removing hamstring-stretch (ceiling) and adding a medium-difficulty correct scenario.

**Verdict: REJECT.** This decision was already frozen. 4:6 with `answer_accurate` covariate is the pre-registered approach. Hamstring-stretch as a ceiling filler has value — it prevents participants from detecting that most scenarios are incorrect and adjusting their response strategy.

---

## Part 2 — New Findings from Power Analysis Review

### Finding P1: Simulation-based power analysis (ACCEPT)

**Claim:** Use `simr` with pilot data, not formula-based power.

**Verdict: ACCEPT.** Already in PRE_REGISTRATION.md section 10. No changes needed.

### Finding P2: Pilot N = 20-25 per condition (ACCEPT)

**Claim:** Pilot needs N=20-25 per condition (40-50 total) to estimate variance components.

**Verdict: ACCEPT.** Already consistent with the pre-reg plan. No changes needed.

### Finding P3: Target N = 160-200 (80-100 per condition) (NOTE)

**Claim:** Power simulation shows d=0.35 needs ~170/condition for 80% power. Recommended total N = 200.

**Verdict: Informational.** This is a budget/PI decision. The pre-reg already specifies pilot → power analysis → final N. No architecture change needed.

---

## Part 3 — New Findings from Reasonix Reproducibility Review

### Finding R1: Scenario random effect missing in all models (ACCEPT)

**Claim:** All lmer/glmer models use `(1 | participant_id)` only. Missing `(1 | scenario_id)` inflates type I error.

**Verdict: ACCEPT.** This was already in my P1.1 of PILOT_READINESS_REVIEW but should be P0 given the "fatal" severity rating from Reasonix. 10 scenarios with a random intercept is borderline but defensible — report both fixed and random versions.

### Finding R2: No attention check scenario in data (ACCEPT)

**Verdict: ACCEPT.** Already in my P0.2. This is the second reviewer independently flagging it.

### Finding R3: No $comment annotations in JSON Schema (ACCEPT)

**Claim:** Frozen spec requires `$comment` with `BRIER_FORMULA_v1` and `TRUST_CLASS_v1` annotations in the JSON Schema.

**Verdict: ACCEPT.** ~5 minute fix. Add `$comment` to the JSON Schema properties for derived-field documentation.

### Finding R4: No example CSV (ACCEPT for P2)

**Verdict:** Useful for reproducibility but doesn't block pilot. Defer.

### Finding R5: No PROLIFIC_SETUP.md (ACCEPT for P1)

**Verdict:** Important for other labs but not blocking pilot. Create before paper submission.

---

## Part 4 — Final P0-P2 Action Plan (Integrating All Reviews)

### P0 — Must Fix Before Pilot

| # | Task | Source | Effort | Files |
|---|---|---|---|---|
| P0.1 | **Demographics form** — Age, gender, AI familiarity | Self-audit | 30 min | `components/scenario-runner.tsx` |
| P0.2 | **Attention check scenario** — Add to fitness.json | Self + Reasonix + Hermes | 10 min | `data/scenarios/fitness.json` |
| P0.3 | **Fix evidence quality for 3 incorrect scenarios** — cardio-before-weights (#8), fasted-cardio (#9), post-workout-stretching (#10). Lower evidence sources to ★1-3 | Hermes scenario review | 30 min | `data/scenarios/fitness.json` |
| P0.4 | **Raise confidence on 3 incorrect scenarios** — protein-timing 75→85, fasted-cardio 72→82, post-workout-stretching 78→85 | Hermes scenario review | 5 min | `data/scenarios/fitness.json` |
| P0.5 | **Add scenario random effect** — `+ (1 \| scenario_id)` to primary + sensitivity models | Reasonix + Self | 5 min | `analysis/compute-brier.R` |
| P0.6 | **Add `$comment` annotations to JSON Schema** — BRIER_FORMULA_v1, TRUST_CLASS_v1 | Reasonix | 5 min | `schemas/log-event.schema.json` |
| P0.7 | **Add `car::Anova()` for GLMM p-values** | Self-audit P0.4 | 5 min | `analysis/compute-brier.R` |
| P0.8 | **Add `study_id` validation in R script** | Self-audit P0.3 | 2 min | `analysis/compute-brier.R` |

**Total P0 effort: ~1.5 hours**

### P1 — Before Full Data Collection

| # | Task | Source | Effort |
|---|---|---|---|
| P1.1 | Write PROLIFIC_SETUP.md | Reasonix | 20 min |
| P1.2 | Verify Prolific URL param names in Preview mode | Self | 15 min |
| P1.3 | Run power simulation after pilot | Power review | — |
| P1.4 | Create pooled-analysis.R for Study 2 | Reasonix | 30 min |
| P1.5 | Add R library installation instructions to README | Reasonix | 5 min |

### P2 — Before Paper Submission

| # | Task | Source |
|---|---|---|
| P2.1 | Write scenario authoring guide (docs/CREATING_SCENARIOS.md) | Reasonix |
| P2.2 | Add example CSV (data/studies/example-output.csv) | Reasonix |
| P2.3 | Choose license (MIT or CC-BY-4.0) | Reasonix |
| P2.4 | Create `npm run study:run` script alias | Self |

---

## Summary of Changes from All Reviews

| Review | Accepted | Rejected | Notes |
|---|---|---|---|
| **PILOT_READINESS** (self) | 4 P0 items | — | All still valid |
| **Scenario domain** (Hermes) | S1 (evidence quality), S2 (confidence raise) | S3 (5:5 balance) | S1 is the highest-impact finding |
| **Power analysis** (Hermes) | P1 (simulation method), P2 (pilot N) | — | Already aligned with pre-reg |
| **Reproducibility** (Reasonix) | R1 (scenario RE), R2 (attention check), R3 ($comment) | — | R1 upgraded from P1 to P0 |

**Net new P0 items from these reviews:** P0.3 (fix evidence quality), P0.4 (raise confidence), P0.5 (scenario random effect), P0.6 ($comment annotations)

The most impactful single change is P0.3 — making evidence quality diagnostic. Without this, the experiment cannot test its core hypothesis.
