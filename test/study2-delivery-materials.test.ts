import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import {
  auditDeliveryMaterials,
  buildDeliveryAuthoringTemplate,
  visibleWordCount,
  type DeliveryCardRow,
  type Study2DeliveryMaterials,
} from '../src/study2/delivery-materials';
import type {
  FrozenStudy2Material,
  FrozenStudy2MaterialsArtifact,
} from '../src/study2/frozen-materials';

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
    finalDecisionBoundary: 'Final boundary.',
    finalNumericalGranularity: 'Direction only.',
  })),
};
const frozenHash = 'c'.repeat(64);

function rowsWithExactWordCount(labels: string[], target: number): DeliveryCardRow[] {
  const labelWords = labels.reduce((sum, label) => sum + label.split(/\s+/u).length, 0);
  const remaining = target - labelWords;
  const counts = [Math.floor(remaining / 3), Math.floor(remaining / 3), 0];
  counts[2] = remaining - counts[0] - counts[1];
  return labels.map((label, index) => ({
    label,
    text: Array.from({ length: counts[index] }, (_, wordIndex) => `detail${index}${wordIndex}`).join(' '),
  }));
}

function completedBundle(): Study2DeliveryMaterials {
  const bundle = buildDeliveryAuthoringTemplate({
    frozen,
    answerVariantVersion: 'study2-answer-variants-v1',
    interventionCardVersion: 'study2-intervention-cards-v1',
    sourceFrozenMaterialsSha256: frozenHash,
  });
  for (const variant of bundle.variants) {
    const precision = variant.failureFamily === 'unsupported_numerical_precision';
    variant.targetFailureSpan = precision ? 'exactly 37 units' : 'for every person';
    variant.answerText = precision
      ? 'The recommendation uses exactly 37 units as a universal evidence-backed threshold.'
      : 'The recommendation applies for every person without stating the action-changing exception.';
    variant.precisionFailurePresent = precision;
    variant.boundaryFailurePresent = !precision;
    variant.coreRecommendationOnlyAccuracyStatus = true;
    variant.displayedConfidenceEmbedded = false;
    const candidate = selectedCandidates.find((item) => item.id === variant.scenarioId)!;
    for (const card of variant.cards) {
      card.rows = rowsWithExactWordCount(card.rows.map((row) => row.label), 40);
      card.citationSourceId = candidate.evidenceSources[0].id;
      assert.equal(visibleWordCount(card.rows), 40);
    }
  }
  return bundle;
}

test('authoring template covers 96 answers and 192 cards but is deliberately invalid', () => {
  const template = buildDeliveryAuthoringTemplate({
    frozen,
    answerVariantVersion: 'study2-answer-variants-v1',
    interventionCardVersion: 'study2-intervention-cards-v1',
    sourceFrozenMaterialsSha256: frozenHash,
  });
  assert.equal(template.variants.length, 96);
  assert.equal(template.variants.reduce((sum, variant) => sum + variant.cards.length, 0), 192);
  assert.ok(template.variants.every((variant) => variant.answerText === ''));
  assert.ok(template.variants.every((variant) => variant.precisionFailurePresent === null));
  assert.ok(template.variants.every((variant) => variant.displayedConfidenceEmbedded === null));
  assert.ok(template.variants.flatMap((variant) => variant.cards).every((card) => card.citationSourceId === ''));
  const audit = auditDeliveryMaterials({
    bundle: template,
    frozen,
    candidates: STUDY2_CANDIDATES,
    expectedFrozenMaterialsSha256: frozenHash,
  });
  assert.equal(audit.structurallyValid, false);
  assert.equal(audit.pilotReady, false);
});

test('completed structural fixture enforces exact variant and card coverage', () => {
  const audit = auditDeliveryMaterials({
    bundle: completedBundle(),
    frozen,
    candidates: STUDY2_CANDIDATES,
    expectedFrozenMaterialsSha256: frozenHash,
  });
  assert.equal(audit.structurallyValid, true, audit.errors.join('\n'));
  assert.equal(audit.pilotReady, false);
  assert.deepEqual(audit.counts, { scenarios: 24, answerVariants: 96, interventionCards: 192 });
  assert.match(audit.warnings.join('\n'), /does not replace independent taxonomy coding/);
});

test('audit rejects wrong answer side, card imbalance, direct verdict cue, and missing card', () => {
  const bundle = completedBundle();
  bundle.variants[0].coreRecommendationOption =
    bundle.variants[0].coreRecommendationOption === 'option_a' ? 'option_b' : 'option_a';
  bundle.variants[1].cards[0].rows[0].text += ' extra';
  bundle.variants[2].cards[0].rows[0].text = `wrong ${bundle.variants[2].cards[0].rows[0].text}`;
  bundle.variants[3].cards.pop();
  const audit = auditDeliveryMaterials({
    bundle,
    frozen,
    candidates: STUDY2_CANDIDATES,
    expectedFrozenMaterialsSha256: frozenHash,
  });
  assert.equal(audit.structurallyValid, false);
  assert.match(audit.errors.join('\n'), /wrong core recommendation/);
  assert.match(audit.errors.join('\n'), /not exactly word-count matched/);
  assert.match(audit.errors.join('\n'), /prohibited direct-verdict cue/);
  assert.match(audit.errors.join('\n'), /requires exactly two intervention cards/);
});
