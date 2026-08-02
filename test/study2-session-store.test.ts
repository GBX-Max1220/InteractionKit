import assert from 'node:assert/strict';
import test from 'node:test';

import {
  selectRecognitionProbeTrials,
  type Study2Event,
  type Study2TrialContext,
} from '../src/study2/events';
import { generateAllocation, placeholderScenarioPool } from '../src/study2/schedule';
import {
  appendStudy2Event,
  auditStudy2SessionStore,
  buildCompletedSessionExport,
  createStudy2SessionStore,
  loadStudy2SessionStore,
  persistStudy2SessionStore,
  type StorageLike,
} from '../src/study2/session-store';
import type { Study2TrialAssignment } from '../src/study2/types';

const allocation = generateAllocation({
  participants: 24,
  scenarios: placeholderScenarioPool('study2-candidates-v0.6'),
  seed: 'study2-session-store-fixture',
  materialVersion: 'study2-candidates-v0.6',
});
const assignments = allocation.trials
  .filter((trial) => trial.participantIndex === 0)
  .sort((first, second) => first.trialIndex - second.trialIndex);

function contextFor(assignment: Study2TrialAssignment): Study2TrialContext {
  return {
    trialIndex: assignment.trialIndex,
    scenarioId: assignment.scenarioId,
    failureFamily: assignment.failureFamily,
    interventionType: assignment.interventionType,
    accuracy: assignment.accuracy,
    displayedConfidence: assignment.confidence,
    supportLevel: assignment.supportLevel,
    matchStatus: assignment.matchStatus,
  };
}

function completeTrace(): Study2Event[] {
  const events: Study2Event[] = [];
  const probes = new Set(selectRecognitionProbeTrials(allocation.seed, 0));
  const add = (
    eventType: Study2Event['eventType'],
    context: Study2TrialContext | null,
    payload: Record<string, unknown>,
  ) => events.push({
    schemaVersion: 'study2-event-v1',
    protocolVersion: 'study2-protocol-v1',
    sessionId: 'session-store-fixture',
    participantId: 'participant-store-fixture',
    participantIndex: 0,
    materialVersion: allocation.materialVersion,
    allocationSeed: allocation.seed,
    eventIndex: events.length,
    timestamp: new Date(Date.UTC(2026, 7, 2, 17, 0, events.length)).toISOString(),
    eventType,
    context,
    payload,
  });
  add('session_started', null, { recruitmentSource: 'local_test' });
  add('comprehension_attempt', null, { attempt: 1, passed: true });
  add('participant_profile', null, {
    ageBracket: '25-34', gender: 'prefer_not_to_say', aiFamiliarity: 4, exerciseExpertise: 3,
  });
  for (const assignment of assignments) {
    const context = contextFor(assignment);
    add('trial_started', context, {
      answerVariantId: `${assignment.scenarioId}:variant`,
      answerVariantVersion: 'answer-v1',
      interventionCardId: `${assignment.scenarioId}:card`,
      interventionCardVersion: 'card-v1',
      recognitionProbeScheduled: probes.has(assignment.trialIndex),
    });
    add('initial_response', context, {
      decision: 'option_a', confidence: 60, familiarity: 3, phaseDurationMs: 1000,
    });
    add('ai_answer_shown', context, {});
    add('intervention_shown', context, { aiReadingDurationMs: 1000 });
    add('post_ai_probability', context, {
      probabilityAiCorrect: 70, interventionReadingDurationMs: 1000,
    });
    add('final_response', context, {
      decision: 'option_b', confidence: 70, phaseDurationMs: 1000,
    });
    if (probes.has(assignment.trialIndex)) {
      add('recognition_probe', context, { emphasis: 'unsure', phaseDurationMs: 500 });
    }
    add('trial_completed', context, { totalTrialDurationMs: 4500 });
  }
  add('post_task_response', null, {
    numericalCardRelevance: 5, boundaryCardRelevance: 5, attentionCheckPassed: true,
  });
  add('session_completed', null, {});
  return events;
}

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failActiveWrite = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failActiveWrite && key.endsWith(':active')) throw new Error('simulated active-slot failure');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test('append-only store derives recovery from a validated hash chain', async () => {
  let store = await createStudy2SessionStore(allocation, 0);
  const emptyAudit = await auditStudy2SessionStore(store, allocation);
  assert.equal(emptyAudit.valid, true, emptyAudit.errors.join('\n'));
  assert.equal(emptyAudit.nextEventType, 'session_started');

  const trace = completeTrace();
  for (const event of trace.slice(0, 4)) {
    store = await appendStudy2Event({ store, event, allocation });
  }
  const audit = await auditStudy2SessionStore(store, allocation);
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.nextEventType, 'initial_response');
  assert.equal(audit.nextTrialIndex, 0);
});

test('content tampering or skipped phases invalidate the store', async () => {
  let store = await createStudy2SessionStore(allocation, 0);
  const trace = completeTrace();
  store = await appendStudy2Event({ store, event: trace[0], allocation });
  await assert.rejects(
    appendStudy2Event({ store, event: trace[2], allocation }),
    /violates the runtime protocol/,
  );
  store = await appendStudy2Event({ store, event: trace[1], allocation });
  const tampered = structuredClone(store);
  tampered.records[1].event.payload.passed = false;
  const audit = await auditStudy2SessionStore(tampered, allocation);
  assert.equal(audit.valid, false);
  assert.match(audit.errors.join('\n'), /hash does not match its content/);
});

test('pending journal slot recovers a longer valid chain after interrupted active write', async () => {
  const trace = completeTrace();
  let first = await createStudy2SessionStore(allocation, 0);
  first = await appendStudy2Event({ store: first, event: trace[0], allocation });
  const storage = new MemoryStorage();
  persistStudy2SessionStore(storage, 'study2-session', first);

  const second = await appendStudy2Event({ store: first, event: trace[1], allocation });
  storage.failActiveWrite = true;
  assert.throws(
    () => persistStudy2SessionStore(storage, 'study2-session', second),
    /simulated active-slot failure/,
  );
  const recovered = await loadStudy2SessionStore({
    storage,
    key: 'study2-session',
    allocation,
  });
  assert.equal(recovered?.recoveredFrom, 'pending');
  assert.equal(recovered?.audit.eventCount, 2);
  assert.equal(recovered?.audit.nextEventType, 'participant_profile');
});

test('completed export rejects prefixes and preserves the audited chain tip', async () => {
  const trace = completeTrace();
  let store = await createStudy2SessionStore(allocation, 0);
  store = await appendStudy2Event({ store, event: trace[0], allocation });
  await assert.rejects(
    buildCompletedSessionExport({
      store,
      allocation,
      exportedAt: '2026-08-02T18:00:00Z',
    }),
    /incomplete session/,
  );
  for (const event of trace.slice(1)) {
    store = await appendStudy2Event({ store, event, allocation });
  }
  const exported = await buildCompletedSessionExport({
    store,
    allocation,
    exportedAt: '2026-08-02T18:00:00Z',
  });
  const audit = await auditStudy2SessionStore(store, allocation);
  assert.equal(exported.events.length, trace.length);
  assert.equal(exported.chainTipHash, audit.chainTipHash);
  assert.equal(exported.allocationSha256, store.allocationSha256);
});
