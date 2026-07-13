# Pilot Protocol — InteractionKit v0.3

## Design

Two-round pilot:
- **Pilot 1**: N=5 (recruit → run → debrief → fix any issues)
- **Pilot 2**: N=15-20 (confirm fixes → estimate variance components)

## Recruitment

- **Platform**: Prolific
- **Criteria**: general population, no fitness knowledge screening
- **Compensation**: Prolific standard rate (~£9-12/hr equivalent)
- **Estimated duration**: 10-15 minutes

## Pre-flight Check (before Pilot 1)

- [ ] Prolific Preview mode: verify PROLIFIC_PID and RETURN_URL parameters are passed correctly
- [ ] Dev server running at localhost:3000
- [ ] /study/confidence-v1-v2 loads and renders consent
- [ ] Full walkthrough: consent → demographics → 10 trials → TSI → debrief → CSV download

## Metrics to Monitor

| Metric | Threshold | Action if exceeded |
|---|---|---|
| Completion rate | < 80% | Check for crashes, errors, or confusing UI |
| Page refresh rate | > 20% | Consider adding event-level checkpoint |
| Unsure rate (overall) | > 15% | Check slider/decision UI for ambiguity |
| Median completion time | < 3 min | Participants not sufficiently engaged |
| Median completion time | > 20 min | Experiment too long; consider reducing trials |
| Attention check failure | > 10% | Check attention check wording |
| CSV export: missing values | Any in core fields | Fix logger bug before Pilot 2 |

## Per-Pilot Log

### Pilot 1 (N=5)

- **Date:**
- **Issues found:**
- **Fixes applied:**
- **Ready for Pilot 2:** [ ]

### Pilot 2 (N=15-20)

- **Date:**
- **Issues found:**
- **Variance components (from analysis):**
  - Participant-level ICC:
  - Scenario-level variance:
  - Residual variance:
- **Estimated effect size (Cohen's d):**
- **Recommended N for Study 1:**
- **Ready for Study 1:** [ ]

## Go / No-Go Criteria

Proceed to Study 1 if ALL of:
1. ✅ Completion rate ≥ 80%
2. ✅ Attention check failure rate ≤ 10%
3. ✅ No data quality issues in CSV (missing values, out-of-range values)
4. ✅ Power simulation shows ≥ 80% power at feasible N (≤ 200/condition)

Otherwise, fix issues and repeat Pilot 2 before proceeding.
