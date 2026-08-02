# Study 2 Candidate Repair v0.2

**Supersedes:** three held candidates in `study2-candidates-v0.1`
**Current material version:** `study2-candidates-v0.2`
**Date:** 2026-08-02

The first full source triage produced 22 candidates with viable evidence paths. Study 2 needs 24 retained materials, including 12 mixed/conditional scenarios. Three held mixed candidates were repaired without relaxing the binary-ground-truth requirement.

## `mixed_03` — rapid carbohydrate recovery

Replaces the protein “30-minute window” scenario, whose two options could both be acceptable after adequate daily intake and a recent meal.

New decision context: a glycogen-depleting endurance session followed by another demanding session in less than four hours.

Source path:

1. Kerksick CM, et al. “International society of sports nutrition position stand: nutrient timing.” *Journal of the International Society of Sports Nutrition*. 2017. DOI: `10.1186/s12970-017-0189-4`; PMID: `28919842`.
2. Thomas DT, Erdman KA, Burke LM. “Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and the American College of Sports Medicine: Nutrition and Athletic Performance.” *Journal of the Academy of Nutrition and Dietetics*. 2016. DOI: `10.1016/j.jand.2015.12.006`; PMID: `26920240`.

Why it is conditionally scorable: prompt refueling is preferred when recovery is shorter than four hours, whereas urgency and dose change when recovery time is longer.

## `mixed_09` — nap after partial sleep restriction

Replaces soreness as a training-effectiveness signal, which had an obvious-answer ceiling and no clean source-to-decision mapping.

New decision context: a young athlete slept substantially less than usual and has an evening performance test.

Source path:

1. Mesas AE, et al. “Is daytime napping an effective strategy to improve sport-related cognitive and physical performance and reduce fatigue? A systematic review and meta-analysis of randomised controlled trials.” *British Journal of Sports Medicine*. 2023. DOI: `10.1136/bjsports-2022-106355`; PMID: `36690376`.
2. Souabni M, et al. “Benefits of Daytime Napping Opportunity on Physical and Cognitive Performances in Physically Active Participants: A Systematic Review.” *Sports Medicine*. 2021. DOI: `10.1007/s40279-021-01482-1`; PMID: `34043185`.

Why it is conditionally scorable: a timed nap is supported after partial sleep loss, while duration, wake-to-test interval, sleep inertia, and individual response remain boundaries.

## `mixed_14` — chronic non-specific low-back pain

Repairs the original prompt by specifying chronic duration. The v0.1 wording mixed acute and chronic evidence.

Source path:

1. Oliveira CB, et al. “Clinical practice guidelines for the management of non-specific low back pain in primary care: an updated overview.” *European Spine Journal*. 2018. DOI: `10.1007/s00586-018-5673-2`; PMID: `29971708`.
2. Rodríguez-Domínguez ÁJ, et al. “Does resistance training improve pain intensity, quality of life, and disability in people with chronic nonspecific low back pain? A systematic review and meta-analysis.” *Disability and Rehabilitation*. 2026. DOI: `10.1080/09638288.2025.2566275`; PMID: `41065407`.

Why it is conditionally scorable: continued individualized exercise is supported for chronic non-specific low-back pain without red flags; diagnosis, symptom behavior, tolerance, and loading progression remain decision boundaries.

## Revised pool accounting

- Evidence-path candidates: 25 of 32
- Strong-consensus evidence paths: 13
- Mixed/conditional evidence paths: 12
- Remaining holds: 7
- Required final pool: 24 (12 per support level)

This count creates one spare strong candidate and no spare mixed candidate. Domain review must not be forced to retain all 12 mixed candidates. Before final freeze, author at least two additional mixed/conditional reserve candidates or be prepared to repair a rejected item and re-run independent review.
