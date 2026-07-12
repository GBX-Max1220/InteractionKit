# InteractionKit — Power Simulation Archive

**Date:** 2026-07-12
**Method:** Participant-level t-test (conservative estimate)
**Parameters:** σ_participant = 0.10, σ_residual = 0.12, n_trials = 10, α = 0.05 one-tailed, n_sim = 3000

## Power by N and effect size

| N/cond | null (d=0.00) | small (δ=0.02, d=0.19) | medium (δ=0.04, d=0.37) | optimistic (δ=0.06, d=0.56) |
|---|---|---|---|---|
| 30 | 5.0% | 17.0% | 41.4% | 69.6% |
| 40 | 4.9% | 19.1% | 51.9% | 80.8% |
| 50 | 5.2% | 24.6% | 58.7% | 87.4% |
| 60 | 5.6% | 26.4% | 65.0% | 91.8% |
| 80 | 4.5% | 32.1% | 77.2% | 97.0% |
| **100** | **4.8%** | **37.2%** | **84.1%** | **99.0%** |
| 120 | 4.7% | 44.0% | 89.0% | 99.6% |
| 150 | 4.8% | 48.6% | 95.2% | 99.9% |
| 200 | 4.9% | 60.9% | 98.4% | 100.0% |

## Sensitivity (minimum detectable δ at 80% power)

| N/cond | min δ | min d |
|---|---|---|
| 60 | 0.050 Brier | 0.46 |
| 80 | 0.042 Brier | 0.39 |
| **100** | **0.038 Brier** | **0.35** |
| 120 | 0.035 Brier | 0.32 |
| 150 | 0.031 Brier | 0.29 |
| 200 | 0.027 Brier | 0.25 |

## False positive rate

All N: 4.5–4.8% (expected 5%, no inflation)

## Recommended N

**100 per condition (200 total)** — 84% power for d=0.37, budget ~$500 Prolific + ~$125 pilot.

Mixed model (lmer with scenario + participant random intercepts) expected to add 2-5% power over this conservative t-test estimate.
