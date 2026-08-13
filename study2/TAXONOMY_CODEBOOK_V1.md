# Study 2 Failure Taxonomy Codebook v1

**Status:** frozen for candidate-material authoring; independent-coder validation pending
**Version:** `study2-taxonomy-v1`
**Scope:** controlled exercise-and-health decisions for lay users

## Unit and retention rule

The unit is one AI answer variant attached to one binary decision scenario. Coders judge the communication failure in the answer, not the truth of the scenario or the quality of its evidence dossier.

Every retained variant must receive exactly one family. A variant coded as both, neither, or unresolved is rejected rather than forced into a category.

## P: Unsupported numerical precision

The answer communicates a number, threshold, interval, probability, dosage, frequency, magnitude, or rank with finer precision or broader invariance than the evidence dossier supports.

Required markers include at least one of:

1. a point estimate where only a range or qualitative direction is supportable;
2. a universal threshold applied across populations or contexts without support;
3. an exact probability or effect magnitude not licensed by the evidence;
4. a timing, dosage, or frequency rule presented as invariant despite documented heterogeneity.

Do not code P when the number is directly supported at the stated population and outcome level, when the central failure is a missing eligibility or safety boundary, or when removing the number leaves the same misleading recommendation.

The parallel non-P answer must preserve recommendation, tone, length band, and fluency while replacing only the unsupported precision with evidence-licensed granularity. It must not add a decision boundary.

## O: Omitted decision boundary

The answer presents a recommendation without a condition needed to decide when, for whom, or under what safety or contextual constraints it applies.

Required omissions include at least one of:

1. a population boundary such as training status, age, pregnancy, diagnosis, medication, or injury state;
2. a goal boundary such as strength, hypertrophy, endurance, recovery, or symptom management;
3. a dose or exposure condition that changes the recommendation;
4. a safety escalation condition requiring professional assessment or cessation;
5. a context boundary such as heat, altitude, fasting, competition schedule, or concurrent load.

Do not code O when the missing detail is merely useful background and cannot change the decision, when the only defect is numerical granularity, or when the answer already states the decision-relevant boundary.

The parallel non-O answer must preserve recommendation, tone, length band, and fluency while adding only the evidence-supported boundary. It must not introduce or repair an unsupported number.

## Accuracy is independently coded

Accuracy refers only to the binary core recommendation frozen in the evidence dossier. Supporting clauses may not carry a second truth value. If a clause creates mixed accuracy, the variant is rejected.

| Failure | Correct core recommendation | Incorrect core recommendation |
|---|---|---|
| P | P-C | P-I |
| O | O-C | O-I |

Failure, accuracy, displayed confidence, intervention, and scenario-level evidence support must remain independently assignable.

## Blind coding procedure

1. Coders receive answer text without labels, cards, confidence values, or ground-truth keys.
2. Each independently records `P`, `O`, `both`, `neither`, or `uncertain`, one quoted marker, and one-sentence rationale.
3. Original judgments are locked before discussion.
4. Retention requires raw agreement at least 90%, kappa at least .80 across the full set, and adjudicated single-family purity.
5. One revision cycle is permitted. Variants still coded `both`, `neither`, or `uncertain` are removed.

## Prohibited shortcuts

- verdict words such as "wrong," "correct," or "myth" before the final decision;
- correctness icons, color coding, or source-quality differences between conditions;
- different citation counts, card layout, or salience across interventions;
- live LLM generation or post-randomization text changes;
- presenting confidence 65 or 85 as a calibrated model probability.

## Evidence boundary

This codebook defines intended constructs. It does not establish coder reliability, participant interpretation, construct validity, or an intervention effect. Those claims require the prespecified coding, pretest, and human-study gates.
