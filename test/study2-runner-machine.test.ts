import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { buildDeliveryAuthoringTemplate, type Study2DeliveryMaterials } from '../src/study2/delivery-materials';
import type { FrozenStudy2Material, FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';
import {
  appendStudy2RunnerEvent,
  deriveStudy2RunnerStep,
  resolveStudy2ParticipantTrial,
  type Study2SessionIdentity,
} from '../src/study2/runner-machine';
import { generateAllocation } from '../src/study2/schedule';
import { auditStudy2SessionStore, createStudy2SessionStore } from '../src/study2/session-store';
import type { Study2EventType } from '../src/study2/events';

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
    finalDecisionBoundary: 'Frozen boundary.',
    finalNumericalGranularity: 'Frozen granularity.',
  })),
};
const allocation = generateAllocation({
  participants: 24,
  scenarios: frozen.items.map((item) => ({ id: item.candidateId, supportLevel: item.finalSupportLevel, materialVersion: frozen.materialVersion })),
  seed: 'study2-runner-fixture-seed',
  materialVersion: frozen.materialVersion,
});

function completedBundle(): Study2DeliveryMaterials {
  const bundle = buildDeliveryAuthoringTemplate({
    frozen,
    answerVariantVersion: 'study2-answer-variants-v1',
    interventionCardVersion: 'study2-intervention-cards-v1',
    sourceFrozenMaterialsSha256: 'c'.repeat(64),
  });
  for (const variant of bundle.variants) {
    variant.answerText = 'Participant-visible AI recommendation and explanation.';
    for (const card of variant.cards) {
      card.rows = card.rows.map((row, index) => ({ label: row.label, text: `Participant-visible evidence row ${index + 1}.` }));
    }
  }
  return bundle;
}

const identity: Study2SessionIdentity = {
  sessionId: 'runner-session-001',
  participantId: 'runner-participant-001',
  participantIndex: 0,
};

function payloadFor(eventType: Study2EventType): Record<string, unknown> {
  switch (eventType) {
    case 'session_started': return { recruitmentSource: 'local_test' };
    case 'comprehension_attempt': return { attempt: 1, passed: true };
    case 'participant_profile': return { ageBracket: '25-34', gender: 'prefer_not_to_say', aiFamiliarity: 3, exerciseExpertise: 2 };
    case 'trial_started': return { attemptedLeak: 'ignored because trial identity is machine-generated' };
    case 'initial_response': return { decision: 'option_a', confidence: 60, familiarity: 3, phaseDurationMs: 1000 };
    case 'ai_answer_shown': return {};
    case 'intervention_shown': return { aiReadingDurationMs: 1200 };
    case 'post_ai_probability': return { probabilityAiCorrect: 70, interventionReadingDurationMs: 900 };
    case 'final_response': return { decision: 'option_b', confidence: 75, phaseDurationMs: 800 };
    case 'recognition_probe': return { emphasis: 'applicability_boundary', phaseDurationMs: 500 };
    case 'trial_completed': return { totalTrialDurationMs: 5000 };
    case 'post_task_response': return { numericalCardRelevance: 5, boundaryCardRelevance: 5, attentionCheckPassed: true };
    case 'session_completed': return {};
  }
}

test('runner view derives only from the audited prefix and excludes hidden condition identities', async () => {
  const bundle = completedBundle();
  const store = await createStudy2SessionStore(allocation, 0);
  const initial = await deriveStudy2RunnerStep({ store, allocation, bundle, frozen });
  assert.deepEqual(initial, { phase: 'consent', nextEventType: 'session_started', trialIndex: null, trial: null });
  const visible = resolveStudy2ParticipantTrial({ allocation, bundle, frozen, participantIndex: 0, trialIndex: 0 });
  const serialized = JSON.stringify(visible);
  for (const forbidden of ['variantId', 'cardId', 'citationSourceId', 'failureFamily', 'interventionType', 'accuracy', 'supportLevel', 'matchStatus', 'finalBinaryDecision']) {
    assert.equal(serialized.includes(forbidden), false, `participant view leaked ${forbidden}`);
  }
  assert.equal(visible.interventionCard.rows.length, 3);
});

test('runner machine produces a complete valid 16-trial hash-chained trace', async () => {
  const bundle = completedBundle();
  let store = await createStudy2SessionStore(allocation, 0);
  let timestampIndex = 0;
  while (true) {
    const step = await deriveStudy2RunnerStep({ store, allocation, bundle, frozen });
    if (step.nextEventType === null) break;
    store = await appendStudy2RunnerEvent({
      store,
      allocation,
      bundle,
      frozen,
      identity,
      eventType: step.nextEventType,
      payload: payloadFor(step.nextEventType),
      timestamp: new Date(Date.UTC(2026, 7, 3, 0, 0, timestampIndex++)).toISOString(),
    });
  }
  const audit = await auditStudy2SessionStore(store, allocation);
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.nextEventType, null);
  assert.equal(store.records.filter((record) => record.event.eventType === 'trial_completed').length, 16);
  assert.equal(store.records.filter((record) => record.event.eventType === 'recognition_probe').length, 4);
  const trialStart = store.records.find((record) => record.event.eventType === 'trial_started')!.event;
  assert.equal('attemptedLeak' in trialStart.payload, false);
  assert.match(String(trialStart.payload.answerVariantId), /::/);
});

test('runner rejects out-of-order input, forbidden payload fields, identity drift, and material drift', async () => {
  const bundle = completedBundle();
  let store = await createStudy2SessionStore(allocation, 0);
  await assert.rejects(
    appendStudy2RunnerEvent({ store, allocation, bundle, frozen, identity, eventType: 'participant_profile', payload: payloadFor('participant_profile'), timestamp: '2026-08-03T00:00:00.000Z' }),
    /expected session_started/,
  );
  store = await appendStudy2RunnerEvent({ store, allocation, bundle, frozen, identity, eventType: 'session_started', payload: payloadFor('session_started'), timestamp: '2026-08-03T00:00:00.000Z' });
  await assert.rejects(
    appendStudy2RunnerEvent({ store, allocation, bundle, frozen, identity: { ...identity, participantId: 'drifted' }, eventType: 'comprehension_attempt', payload: payloadFor('comprehension_attempt'), timestamp: '2026-08-03T00:00:01.000Z' }),
    /changes session field participantId/,
  );
  await assert.rejects(
    appendStudy2RunnerEvent({ store, allocation, bundle, frozen, identity, eventType: 'comprehension_attempt', payload: { ...payloadFor('comprehension_attempt'), groundTruth: 'option_a' }, timestamp: '2026-08-03T00:00:01.000Z' }),
    /Unexpected comprehension_attempt payload fields/,
  );
  const driftedBundle = completedBundle();
  driftedBundle.frozenMaterialVersion = 'wrong-version';
  await assert.rejects(
    deriveStudy2RunnerStep({ store, allocation, bundle: driftedBundle, frozen }),
    /material versions do not match/,
  );
});
