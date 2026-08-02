# Study 2 Candidate Repair v0.4

**Supersedes:** unresolved `mixed_15` in `study2-candidates-v0.3`
**Current material version:** `study2-candidates-v0.4`
**Date:** 2026-08-02

## Why the hydration item was removed

The prior prompt compared a precomputed drinking plan with drinking to thirst during a long event in variable weather. The cited position and consensus statements establish risks from both dehydration and overdrinking, but the prompt did not specify enough context to make either option uniquely preferable. Its registry answer remained `unresolved`; counting it among viable candidates overstated the mixed/conditional reserve margin.

## `mixed_15` — carbohydrate during prolonged endurance performance

New decision context: a healthy endurance athlete prioritizes performance in an event lasting more than 90 minutes and tolerates carbohydrate during exercise.

Provisional preferred decision: consume carbohydrate during the event rather than use water without carbohydrate.

Source path:

1. Kerksick CM, et al. “International society of sports nutrition position stand: nutrient timing.” *Journal of the International Society of Sports Nutrition*. 2017;14:33. DOI: `10.1186/s12970-017-0189-4`; PMID: `28919842`; PMCID: `PMC5596471`.
2. Pöchmüller M, et al. “Meta-Analysis of Carbohydrate Solution Intake during Prolonged Exercise in Adults: From the Last 45+ Years' Perspective.” *Nutrients*. 2021;13(12):4223. DOI: `10.3390/nu13124223`; PMID: `34959776`; PMCID: `PMC8707589`.

Why it is conditionally scorable: the prompt fixes duration, performance goal, and tolerance, making carbohydrate intake the supported decision. Event intensity, gastrointestinal response, pre-event nutrition, carbohydrate form, and individualized dose remain genuine boundaries. The item therefore tests calibration rather than recall of one universal intake rate.

## Revised pool accounting

- Evidence-path candidates: 27 of 32
- Strong-consensus evidence paths: 13
- Mixed/conditional evidence paths with a provisional binary answer: 14
- Remaining holds: 5
- Required final pool: 24 (12 per support level)

The numerical reserve count is unchanged, but it is now internally coherent: every candidate counted as viable has a provisional binary decision. Independent domain review may still reject or revise any item.
