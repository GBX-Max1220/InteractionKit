import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { buildDeliveryAuthoringTemplate } from '../src/study2/delivery-materials';
import type { FrozenStudy2Material, FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';
import {
  readStudy2Runtime,
  submitStudy2RuntimeAction,
  type Study2RuntimeRepository,
  type Study2ServerRuntimeState,
  type VersionedStudy2RuntimeState,
} from '../src/study2/runtime-service';
import { generateAllocation } from '../src/study2/schedule';
import { createStudy2SessionStore } from '../src/study2/session-store';

const candidates = STUDY2_CANDIDATES.filter((item) => item.status === 'source_dossier_complete');
const selected = [
  ...candidates.filter((item) => item.provisionalSupportLevel === 'strong_consensus').slice(0, 12),
  ...candidates.filter((item) => item.provisionalSupportLevel === 'mixed_or_conditional').slice(0, 12),
];
const frozen: FrozenStudy2MaterialsArtifact = {
  schemaVersion: 'study2-frozen-materials-v1', roundId: 'study2-domain-review-round-v2', materialVersion: 'study2-candidates-v0.6', sourceOutcomeSha256: 'a'.repeat(64), sourceSelectionSha256: 'b'.repeat(64),
  items: selected.map((candidate, index): FrozenStudy2Material => ({ candidateId: candidate.id, domain: candidate.domain, decisionPrompt: candidate.decisionPrompt, optionA: candidate.optionA, optionB: candidate.optionB, targetPopulation: candidate.targetPopulation, finalBinaryDecision: index % 2 ? 'option_a' : 'option_b', finalSupportLevel: index < 12 ? 'strong_consensus' : 'mixed_or_conditional', finalDecisionBoundary: 'Boundary.', finalNumericalGranularity: 'Granularity.' })),
};
const allocation = generateAllocation({ participants: 24, scenarios: frozen.items.map((item) => ({ id: item.candidateId, supportLevel: item.finalSupportLevel, materialVersion: frozen.materialVersion })), seed: 'runtime-service-seed', materialVersion: frozen.materialVersion });
const bundle = buildDeliveryAuthoringTemplate({ frozen, answerVariantVersion: 'answers-v1', interventionCardVersion: 'cards-v1', sourceFrozenMaterialsSha256: 'c'.repeat(64) });
for (const variant of bundle.variants) {
  variant.answerText = 'Participant-visible answer.';
  for (const card of variant.cards) card.rows = card.rows.map((row, index) => ({ label: row.label, text: `Evidence row ${index + 1}.` }));
}
const token = 'opaque_runtime_access_token_1234567890';

class MemoryRepository implements Study2RuntimeRepository {
  constructor(public value: VersionedStudy2RuntimeState) {}
  async loadByAccessToken(accessToken: string) { return accessToken === token ? structuredClone(this.value) : null; }
  async compareAndSwap(options: { accessToken: string; expectedRevision: number; nextState: Study2ServerRuntimeState }) {
    if (options.accessToken !== token || options.expectedRevision !== this.value.revision) return false;
    this.value = { revision: this.value.revision + 1, state: structuredClone(options.nextState) };
    return true;
  }
}

async function fixture() {
  const store = await createStudy2SessionStore(allocation, 0);
  const state: Study2ServerRuntimeState = { schemaVersion: 'study2-server-runtime-state-v1', allocation, bundle, frozen, identity: { sessionId: 'private-session-id', participantId: 'private-participant-id', participantIndex: 0 }, recruitmentSource: 'private-recruitment-source', store };
  return new MemoryRepository({ revision: 0, state });
}

test('read response exposes only public current-phase material and an opaque integrity receipt', async () => {
  const repository = await fixture();
  const response = await readStudy2Runtime({ repository, accessToken: token });
  assert.equal(response.view.phase, 'consent');
  assert.equal(response.revision, 0);
  assert.equal(response.receipt.eventCount, 0);
  const serialized = JSON.stringify(response);
  for (const forbidden of ['private-session-id', 'private-participant-id', 'private-recruitment-source', 'allocation', 'failureFamily', 'accuracy', 'matchStatus']) assert.equal(serialized.includes(forbidden), false);
});

test('submit maps action server-side, appends once, and advances revision and phase', async () => {
  const repository = await fixture();
  const response = await submitStudy2RuntimeAction({ repository, accessToken: token, expectedRevision: 0, action: { action: 'consent', consented: true }, serverTimestamp: '2026-08-03T03:00:00.000Z' });
  assert.equal(response.revision, 1);
  assert.equal(response.receipt.eventCount, 1);
  assert.equal(response.view.phase, 'comprehension');
  assert.equal(repository.value.state.store.records[0].event.payload.recruitmentSource, 'private-recruitment-source');
});

test('stale or concurrent submissions cannot duplicate an event', async () => {
  const repository = await fixture();
  await submitStudy2RuntimeAction({ repository, accessToken: token, expectedRevision: 0, action: { action: 'consent', consented: true }, serverTimestamp: '2026-08-03T03:00:00.000Z' });
  await assert.rejects(
    submitStudy2RuntimeAction({ repository, accessToken: token, expectedRevision: 0, action: { action: 'consent', consented: true }, serverTimestamp: '2026-08-03T03:00:01.000Z' }),
    /revision conflict/,
  );
  assert.equal(repository.value.state.store.records.length, 1);

  const racingRepository = await fixture();
  const originalCas = racingRepository.compareAndSwap.bind(racingRepository);
  let first = true;
  racingRepository.compareAndSwap = async (options) => {
    if (first) { first = false; racingRepository.value.revision += 1; }
    return originalCas(options);
  };
  await assert.rejects(
    submitStudy2RuntimeAction({ repository: racingRepository, accessToken: token, expectedRevision: 0, action: { action: 'consent', consented: true }, serverTimestamp: '2026-08-03T03:00:00.000Z' }),
    /Concurrent Study 2 action/,
  );
  assert.equal(racingRepository.value.state.store.records.length, 0);
});
