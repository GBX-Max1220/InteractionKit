import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { buildDeliveryAuthoringTemplate } from '../src/study2/delivery-materials';
import type { FrozenStudy2Material, FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';
import {
  prepareStudy2RuntimeSeeds,
  type Study2RuntimeDeploymentGate,
} from '../src/study2/runtime-seeding';
import { generateAllocation } from '../src/study2/schedule';
import { canonicalJson, sha256 } from '../src/study2/session-store';

const candidates = STUDY2_CANDIDATES.filter((item) => item.status === 'source_dossier_complete');
const selected = [
  ...candidates.filter((item) => item.provisionalSupportLevel === 'strong_consensus').slice(0, 12),
  ...candidates.filter((item) => item.provisionalSupportLevel === 'mixed_or_conditional').slice(0, 12),
];
const frozen: FrozenStudy2MaterialsArtifact = {
  schemaVersion: 'study2-frozen-materials-v1',
  roundId: 'test-round',
  materialVersion: 'test-frozen-v1',
  sourceOutcomeSha256: 'a'.repeat(64),
  sourceSelectionSha256: 'b'.repeat(64),
  items: selected.map((candidate, index): FrozenStudy2Material => ({
    candidateId: candidate.id,
    domain: candidate.domain,
    decisionPrompt: candidate.decisionPrompt,
    optionA: candidate.optionA,
    optionB: candidate.optionB,
    targetPopulation: candidate.targetPopulation,
    finalBinaryDecision: index % 2 ? 'option_a' : 'option_b',
    finalSupportLevel: index < 12 ? 'strong_consensus' : 'mixed_or_conditional',
    finalDecisionBoundary: 'Test boundary.',
    finalNumericalGranularity: 'Test granularity.',
  })),
};
const allocation = generateAllocation({
  participants: 240,
  scenarios: frozen.items.map((item) => ({
    id: item.candidateId,
    supportLevel: item.finalSupportLevel,
    materialVersion: frozen.materialVersion,
  })),
  seed: 'runtime-seeding-test-seed',
  materialVersion: frozen.materialVersion,
});
const bundle = buildDeliveryAuthoringTemplate({
  frozen,
  answerVariantVersion: 'test-answers-v1',
  interventionCardVersion: 'test-cards-v1',
  sourceFrozenMaterialsSha256: 'c'.repeat(64),
});
for (const variant of bundle.variants) {
  variant.answerText = 'Participant-visible test answer.';
  for (const card of variant.cards) {
    card.rows = card.rows.map((row, index) => ({ label: row.label, text: `Evidence row ${index + 1}.` }));
  }
}
const taxonomyFinalization = { schemaVersion: 'test-taxonomy-finalization', passed: true };
const cardSafetyFinalization = { schemaVersion: 'test-card-safety-finalization', passed: true };
const presentationAudit = { schemaVersion: 'test-presentation-audit', passed: true };

async function digest(value: unknown): Promise<string> {
  return sha256(canonicalJson(value));
}

async function gate(): Promise<Study2RuntimeDeploymentGate> {
  return {
    schemaVersion: 'study2-runtime-deployment-gate-v1',
    authorizationStatus: 'approved_for_pilot',
    authorizedBy: 'test-authorizer',
    authorizedAt: '2026-08-03T05:00:00.000Z',
    ethicsApprovalReference: 'test-ethics-reference',
    preregistrationReference: 'https://osf.io/test/',
    recruitmentSource: 'test-recruitment-source',
    studyBaseUrl: 'https://study.example/study2',
    allocationSha256: await digest(allocation),
    deliveryBundleSha256: await digest(bundle),
    frozenMaterialsSha256: await digest(frozen),
    taxonomyFinalizationSha256: await digest(taxonomyFinalization),
    cardSafetyFinalizationSha256: await digest(cardSafetyFinalization),
    presentationAuditSha256: await digest(presentationAudit),
  };
}

test('pilot seeding creates exactly 240 opaque, participant-bound runtime states', async () => {
  const seeds = await prepareStudy2RuntimeSeeds({
    allocation,
    bundle,
    frozen,
    gate: await gate(),
    taxonomyFinalization,
    cardSafetyFinalization,
    presentationAudit,
    tokenFactory: (index) => `test_runtime_access_${String(index).padStart(3, '0')}_${'x'.repeat(32)}`,
  });
  assert.equal(seeds.length, 240);
  assert.equal(new Set(seeds.map((seed) => seed.accessToken)).size, 240);
  assert.equal(seeds[239].state.identity.participantIndex, 239);
  assert.equal(seeds[0].state.store.records.length, 0);
  assert.match(seeds[0].accessUrl, /^https:\/\/study\.example\/study2#access_token=/u);
  assert.equal(seeds[0].accessUrl.includes(seeds[0].state.identity.sessionId), false);
});

test('pilot seeding fails closed on drifted artifacts and non-HTTPS deployment', async () => {
  const approved = await gate();
  await assert.rejects(
    prepareStudy2RuntimeSeeds({
      allocation: { ...allocation, seed: 'drifted' },
      bundle,
      frozen,
      gate: approved,
      taxonomyFinalization,
      cardSafetyFinalization,
      presentationAudit,
    }),
    /Allocation no longer matches/u,
  );
  await assert.rejects(
    prepareStudy2RuntimeSeeds({
      allocation,
      bundle,
      frozen,
      gate: { ...approved, studyBaseUrl: 'http://study.example/study2' },
      taxonomyFinalization,
      cardSafetyFinalization,
      presentationAudit,
    }),
    /credential-free HTTPS/u,
  );
});
