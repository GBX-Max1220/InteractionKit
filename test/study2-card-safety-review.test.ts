import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditCardSafetyPair,
  CARD_SAFETY_CRITERIA,
  generateCardSafetyPacket,
  validateCardSafetyReviewerRoster,
  validateCardSafetySubmission,
  type CardSafetyCrosswalkItem,
  type CardSafetyPacket,
  type CardSafetyReviewerRoster,
  type CardSafetySubmission,
} from '../src/study2/card-safety-review';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { buildDeliveryAuthoringTemplate, type Study2DeliveryMaterials } from '../src/study2/delivery-materials';
import { STUDY2_EVIDENCE_DOSSIERS } from '../src/study2/evidence-dossiers';
import type { FrozenStudy2Material, FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';

const sourceComplete = STUDY2_CANDIDATES.filter((candidate) => candidate.status === 'source_dossier_complete');
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
    finalDecisionBoundary: 'Frozen decision boundary.',
    finalNumericalGranularity: 'Frozen numerical granularity.',
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
    variant.answerText = 'The response gives a recommendation with a deliberately authored calibration defect.';
    const candidate = selectedCandidates.find((item) => item.id === variant.scenarioId)!;
    for (const card of variant.cards) {
      card.rows = card.rows.map((row, index) => ({
        label: row.label,
        text: `neutral evidence detail ${index + 1} for participant review`,
      }));
      card.citationSourceId = candidate.evidenceSources[0].id;
    }
  }
  return bundle;
}

function completedSubmission(packet: CardSafetyPacket): CardSafetySubmission {
  return {
    schemaVersion: 'study2-card-safety-submission-v1',
    roundId: packet.roundId,
    answerVariantVersion: packet.answerVariantVersion,
    interventionCardVersion: packet.interventionCardVersion,
    reviewerId: packet.reviewerId,
    packetSeed: packet.packetSeed,
    trainingCompleted: true,
    independenceAttestation: true,
    hypothesisBlindAttestation: true,
    materialContributionConflict: false,
    submittedAt: '2026-08-03T00:00:00.000Z',
    items: packet.items.map((item) => ({
      blindId: item.blindId,
      judgments: {
        directVerdictCuePresent: false,
        relianceDirectivePresent: false,
        confidenceCuePresent: false,
        answerSpecificFramingPresent: false,
        unsupportedCardClaimPresent: false,
      },
      flaggedTextSpans: [],
      sourceAssessmentRationale: 'The card neutrally states source-bounded evidence without evaluating the answer.',
      reviewerConfidence: 5,
    })),
  };
}

function roster(): CardSafetyReviewerRoster {
  return {
    schemaVersion: 'study2-card-safety-reviewer-roster-v1',
    roundId: 'study2-card-safety-round-v1',
    entries: ['card-reviewer-a', 'card-reviewer-b'].map((reviewerId, index) => ({
      reviewerId,
      stablePersonId: `private-card-reviewer-${index + 1}`,
      trainingExampleVersion: 'study2-card-safety-training-v1',
      trainingCompleted: true,
      materialContributionConflict: false,
      hypothesisBlindAttestation: true,
      eligibilityDecision: 'eligible' as const,
      verifiedBy: 'study-coordinator',
      verifiedAt: '2026-08-03T00:00:00.000Z',
    })),
  };
}

function reviewArtifacts() {
  const bundle = completedBundle();
  const first = generateCardSafetyPacket({ bundle, frozen, dossiers: STUDY2_EVIDENCE_DOSSIERS, reviewerId: 'card-reviewer-a', seed: 'card-safety-seed-v1' });
  const second = generateCardSafetyPacket({ bundle, frozen, dossiers: STUDY2_EVIDENCE_DOSSIERS, reviewerId: 'card-reviewer-b', seed: 'card-safety-seed-v1' });
  return { bundle, first, second };
}

test('reviewers receive independently randomized 192-card packets without condition identities', () => {
  const { bundle, first, second } = reviewArtifacts();
  assert.equal(first.packet.items.length, 192);
  assert.equal(second.packet.items.length, 192);
  assert.notDeepEqual(first.crosswalk.map((item) => item.cardId), second.crosswalk.map((item) => item.cardId));
  assert.deepEqual(
    [...first.crosswalk.map((item) => item.cardId)].sort(),
    [...bundle.variants.flatMap((variant) => variant.cards.map((card) => card.cardId))].sort(),
  );
  const serialized = JSON.stringify(first.packet);
  for (const forbidden of ['cardId', 'variantId', 'failureFamily', 'accuracy', 'interventionType', 'coreRecommendationOption', 'finalBinaryDecision']) {
    assert.equal(serialized.includes(forbidden), false, `card-safety packet leaked ${forbidden}`);
  }
  assert.equal(first.submissionTemplate.trainingCompleted, false);
  assert.equal(first.submissionTemplate.materialContributionConflict, true);
  assert.ok(first.submissionTemplate.items.every((item) => CARD_SAFETY_CRITERIA.every((criterion) => item.judgments[criterion] === null)));
});

test('complete two-reviewer no-leakage agreement retains all 192 cards', () => {
  const { bundle, first, second } = reviewArtifacts();
  const firstSubmission = completedSubmission(first.packet);
  const secondSubmission = completedSubmission(second.packet);
  assert.equal(validateCardSafetySubmission(firstSubmission, first.packet).valid, true);
  const audit = auditCardSafetyPair({
    bundle,
    firstPacket: first.packet,
    firstCrosswalk: first.crosswalk,
    firstSubmission,
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
    secondSubmission,
    reviewerRoster: roster(),
  });
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.rawCriterionAgreement, 1);
  assert.equal(audit.gwetsAc1, 1);
  assert.equal(audit.passesAggregateThresholds, true);
  assert.equal(audit.allCardsRetained, true);
  assert.deepEqual(audit.counts, { cards: 192, criterionJudgments: 960, agreements: 960, retained: 192, disputedOrFlagged: 0 });
});

test('reviewer flags and disagreements fail aggregate and per-card gates', () => {
  const { bundle, first, second } = reviewArtifacts();
  const firstSubmission = completedSubmission(first.packet);
  const secondSubmission = completedSubmission(second.packet);
  for (const item of secondSubmission.items.slice(0, 40)) {
    for (const criterion of CARD_SAFETY_CRITERIA) item.judgments[criterion] = true;
    item.flaggedTextSpans = ['neutral'];
  }
  const audit = auditCardSafetyPair({
    bundle,
    firstPacket: first.packet,
    firstCrosswalk: first.crosswalk,
    firstSubmission,
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
    secondSubmission,
    reviewerRoster: roster(),
  });
  assert.equal(audit.valid, true);
  assert.ok(audit.rawCriterionAgreement < 0.9);
  assert.ok(audit.gwetsAc1 < 0.8);
  assert.equal(audit.passesAggregateThresholds, false);
  assert.equal(audit.allCardsRetained, false);
  assert.equal(audit.counts.disputedOrFlagged, 40);
});

test('validators reject same-person reviewers, invented criteria, nonverbatim spans, and duplicate crosswalk cards', () => {
  const { bundle, first, second } = reviewArtifacts();
  const invalidRoster = roster();
  invalidRoster.entries[1].stablePersonId = invalidRoster.entries[0].stablePersonId.toUpperCase();
  assert.equal(validateCardSafetyReviewerRoster(invalidRoster, ['card-reviewer-a', 'card-reviewer-b']).valid, false);

  const malformed = completedSubmission(first.packet);
  const judgments = malformed.items[0].judgments as unknown as Record<string, boolean>;
  delete judgments.directVerdictCuePresent;
  judgments.inventedCriterion = false;
  malformed.items[1].judgments.directVerdictCuePresent = true;
  malformed.items[1].flaggedTextSpans = ['not present in card'];
  const validation = validateCardSafetySubmission(malformed, first.packet);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /exactly the five defined/);
  assert.match(validation.errors.join('\n'), /not verbatim/);

  const duplicateCrosswalk: CardSafetyCrosswalkItem[] = structuredClone(first.crosswalk);
  duplicateCrosswalk[1].cardId = duplicateCrosswalk[0].cardId;
  const audit = auditCardSafetyPair({
    bundle,
    firstPacket: first.packet,
    firstCrosswalk: duplicateCrosswalk,
    firstSubmission: completedSubmission(first.packet),
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
    secondSubmission: completedSubmission(second.packet),
    reviewerRoster: roster(),
  });
  assert.equal(audit.valid, false);
  assert.match(audit.errors.join('\n'), /must be non-empty and unique/);
});
