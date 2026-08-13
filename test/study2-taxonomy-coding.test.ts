import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import {
  buildDeliveryAuthoringTemplate,
  type Study2DeliveryMaterials,
} from '../src/study2/delivery-materials';
import type {
  FrozenStudy2Material,
  FrozenStudy2MaterialsArtifact,
} from '../src/study2/frozen-materials';
import {
  auditTaxonomyCodingPair,
  generateTaxonomyCodingPacket,
  validateTaxonomyCoderRoster,
  validateTaxonomyCodingSubmission,
  type TaxonomyCoderRoster,
  type TaxonomyCodingCrosswalkItem,
  type TaxonomyCodingPacket,
  type TaxonomyCodingSubmission,
  type TaxonomyCriterionJudgments,
} from '../src/study2/taxonomy-coding';
import type { FailureFamily } from '../src/study2/types';

const sourceComplete = STUDY2_CANDIDATES.filter(
  (candidate) => candidate.status === 'source_dossier_complete',
);
const selectedCandidates = [
  ...sourceComplete.filter((candidate) => candidate.provisionalSupportLevel === 'strong_consensus').slice(0, 12),
  ...sourceComplete.filter((candidate) => candidate.provisionalSupportLevel === 'mixed_or_conditional').slice(0, 12),
];
const frozen: FrozenStudy2MaterialsArtifact = {
  schemaVersion: 'study2-frozen-materials-v1',
  roundId: 'study2-domain-review-round-v2',
  materialVersion: 'study2-candidates-v0.6',
  sourceOutcomeSha256: 'a'.repeat(64),
  sourceSelectionSha256: 'b'.repeat(64),
  items: selectedCandidates.map((candidate, index): FrozenStudy2Material => ({
    candidateId: candidate.id,
    domain: candidate.domain,
    decisionPrompt: candidate.decisionPrompt,
    optionA: candidate.optionA,
    optionB: candidate.optionB,
    targetPopulation: candidate.targetPopulation,
    finalBinaryDecision: index % 12 < 6 ? 'option_a' : 'option_b',
    finalSupportLevel: index < 12 ? 'strong_consensus' : 'mixed_or_conditional',
    finalDecisionBoundary: 'A concrete evidence-supported action-changing boundary.',
    finalNumericalGranularity: 'Direction only; exact numerical granularity is unsupported.',
  })),
};

function completedBundle(): Study2DeliveryMaterials {
  const bundle = buildDeliveryAuthoringTemplate({
    frozen,
    answerVariantVersion: 'study2-answer-variants-v1',
    interventionCardVersion: 'study2-intervention-cards-v1',
    sourceFrozenMaterialsSha256: 'c'.repeat(64),
  });
  for (const variant of bundle.variants) {
    const precision = variant.failureFamily === 'unsupported_numerical_precision';
    variant.targetFailureSpan = precision ? 'exactly 37 units' : 'for every person';
    variant.answerText = precision
      ? `For ${variant.variantId}, use exactly 37 units as a universal threshold.`
      : `For ${variant.variantId}, this applies for every person without an exception.`;
  }
  return bundle;
}

function criteriaFor(label: FailureFamily): TaxonomyCriterionJudgments {
  const precision = label === 'unsupported_numerical_precision';
  return {
    containsSpecificNumber: precision,
    numberChangesJudgmentOrAction: precision,
    numericalGranularityUnsupported: precision,
    wideningNumberRepairsWithoutBoundary: precision,
    expressesGeneralRecommendation: !precision,
    concreteBoundaryConditionMissing: !precision,
    crossingBoundaryChangesDecision: !precision,
    addingClauseRepairsWithoutPrecisionChange: !precision,
  };
}

function completedSubmission(
  packet: TaxonomyCodingPacket,
  crosswalk: TaxonomyCodingCrosswalkItem[],
  bundle: Study2DeliveryMaterials,
): TaxonomyCodingSubmission {
  const familyByVariant = new Map(bundle.variants.map((variant) => [variant.variantId, variant.failureFamily]));
  const variantByBlind = new Map(crosswalk.map((item) => [item.blindId, item.variantId]));
  return {
    schemaVersion: 'study2-taxonomy-coding-submission-v1',
    roundId: packet.roundId,
    answerVariantVersion: packet.answerVariantVersion,
    coderId: packet.coderId,
    packetSeed: packet.packetSeed,
    trainingCompleted: true,
    independenceAttestation: true,
    hypothesisBlindAttestation: true,
    materialContributionConflict: false,
    submittedAt: '2026-08-03T00:00:00.000Z',
    items: packet.items.map((item) => {
      const familyLabel = familyByVariant.get(variantByBlind.get(item.blindId)!)!;
      return {
        blindId: item.blindId,
        familyLabel,
        criteria: criteriaFor(familyLabel),
        decisiveTextSpan: familyLabel === 'unsupported_numerical_precision' ? 'exactly 37 units' : 'for every person',
        coderConfidence: 5,
        rationale: 'The decisive answer text satisfies all four criteria for the selected family only.',
      };
    }),
  };
}

function coderRoster(): TaxonomyCoderRoster {
  return {
    schemaVersion: 'study2-taxonomy-coder-roster-v1',
    roundId: 'study2-taxonomy-coding-round-v1',
    entries: ['taxonomy-coder-a', 'taxonomy-coder-b'].map((coderId, index) => ({
      coderId,
      stablePersonId: `private-person-${index + 1}`,
      trainingExampleVersion: 'taxonomy-training-v1',
      trainingCompleted: true,
      materialContributionConflict: false,
      hypothesisBlindAttestation: true,
      eligibilityDecision: 'eligible' as const,
      verifiedBy: 'study-coordinator',
      verifiedAt: '2026-08-03T00:00:00.000Z',
    })),
  };
}

function packets() {
  const bundle = completedBundle();
  const first = generateTaxonomyCodingPacket({ bundle, frozen, coderId: 'taxonomy-coder-a', seed: 'round-seed-v1' });
  const second = generateTaxonomyCodingPacket({ bundle, frozen, coderId: 'taxonomy-coder-b', seed: 'round-seed-v1' });
  return { bundle, first, second };
}

test('two coder packets independently randomize all answers without leaking intended conditions', () => {
  const { bundle, first, second } = packets();
  assert.equal(first.packet.items.length, 96);
  assert.equal(second.packet.items.length, 96);
  assert.notDeepEqual(first.crosswalk.map((item) => item.variantId), second.crosswalk.map((item) => item.variantId));
  assert.deepEqual(
    [...first.crosswalk.map((item) => item.variantId)].sort(),
    [...bundle.variants.map((variant) => variant.variantId)].sort(),
  );
  const serialized = JSON.stringify([first.packet, second.packet]);
  for (const forbidden of [
    'variantId', 'failureFamily', 'accuracy', 'coreRecommendationOption',
    'finalBinaryDecision', 'interventionType', 'cards', 'provisionalSupportLevel',
  ]) assert.equal(serialized.includes(forbidden), false, `packet leaked ${forbidden}`);
  assert.equal(first.submissionTemplate.trainingCompleted, false);
  assert.equal(first.submissionTemplate.independenceAttestation, false);
  assert.equal(first.submissionTemplate.materialContributionConflict, true);
  assert.ok(first.submissionTemplate.items.every((item) => item.familyLabel === 'unresolved'));
  assert.ok(first.submissionTemplate.items.every((item) => Object.values(item.criteria).every((value) => value === null)));
});

test('complete independent agreement passes raw agreement, kappa, and intended-family gates', () => {
  const { bundle, first, second } = packets();
  const firstSubmission = completedSubmission(first.packet, first.crosswalk, bundle);
  const secondSubmission = completedSubmission(second.packet, second.crosswalk, bundle);
  assert.equal(validateTaxonomyCodingSubmission(firstSubmission, first.packet).valid, true);
  const audit = auditTaxonomyCodingPair({
    bundle,
    firstPacket: first.packet,
    firstCrosswalk: first.crosswalk,
    firstSubmission,
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
    secondSubmission,
    coderRoster: coderRoster(),
  });
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.rawAgreement, 1);
  assert.equal(audit.cohensKappa, 1);
  assert.equal(audit.passesAggregateThresholds, true);
  assert.equal(audit.allVariantsRetained, true);
  assert.deepEqual(audit.counts, { coded: 96, agreements: 96, retained: 96, disputed: 0 });
});

test('twelve coherent disagreements fail aggregate and per-item retention gates', () => {
  const { bundle, first, second } = packets();
  const firstSubmission = completedSubmission(first.packet, first.crosswalk, bundle);
  const secondSubmission = completedSubmission(second.packet, second.crosswalk, bundle);
  for (const item of secondSubmission.items.slice(0, 12)) {
    const replacement: FailureFamily = item.familyLabel === 'unsupported_numerical_precision'
      ? 'omitted_decision_boundary'
      : 'unsupported_numerical_precision';
    item.familyLabel = replacement;
    item.criteria = criteriaFor(replacement);
  }
  const audit = auditTaxonomyCodingPair({
    bundle,
    firstPacket: first.packet,
    firstCrosswalk: first.crosswalk,
    firstSubmission,
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
    secondSubmission,
    coderRoster: coderRoster(),
  });
  assert.equal(audit.valid, true);
  assert.equal(audit.rawAgreement, 0.875);
  assert.ok(audit.cohensKappa < 0.8);
  assert.equal(audit.passesAggregateThresholds, false);
  assert.equal(audit.allVariantsRetained, false);
  assert.equal(audit.counts.disputed, 12);
});

test('validators reject same-person coders, invented criterion keys, and duplicate crosswalk mappings', () => {
  const { bundle, first, second } = packets();
  const roster = coderRoster();
  roster.entries[1].stablePersonId = roster.entries[0].stablePersonId.toUpperCase();
  assert.equal(validateTaxonomyCoderRoster(roster, ['taxonomy-coder-a', 'taxonomy-coder-b']).valid, false);

  const firstSubmission = completedSubmission(first.packet, first.crosswalk, bundle);
  const malformedCriteria = firstSubmission.items[0].criteria as unknown as Record<string, boolean>;
  delete malformedCriteria.containsSpecificNumber;
  malformedCriteria.inventedCriterion = true;
  const validation = validateTaxonomyCodingSubmission(firstSubmission, first.packet);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /exactly the eight defined/);

  const repairedFirst = completedSubmission(first.packet, first.crosswalk, bundle);
  const secondSubmission = completedSubmission(second.packet, second.crosswalk, bundle);
  const duplicateCrosswalk = structuredClone(first.crosswalk);
  duplicateCrosswalk[1].variantId = duplicateCrosswalk[0].variantId;
  const audit = auditTaxonomyCodingPair({
    bundle,
    firstPacket: first.packet,
    firstCrosswalk: duplicateCrosswalk,
    firstSubmission: repairedFirst,
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
    secondSubmission,
    coderRoster: coderRoster(),
  });
  assert.equal(audit.valid, false);
  assert.match(audit.errors.join('\n'), /must be non-empty and unique/);
});
