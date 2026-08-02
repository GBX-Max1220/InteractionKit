import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditStudy2Session,
  auditStudy2SessionPrefix,
  selectRecognitionProbeTrials,
  type Study2Event,
  type Study2TrialContext,
  validateStudy2Event,
} from '../src/study2/events';
import { generateAllocation, placeholderScenarioPool } from '../src/study2/schedule';
import type { Study2TrialAssignment } from '../src/study2/types';

const allocation = generateAllocation({
  participants: 24,
  scenarios: placeholderScenarioPool('study2-candidates-v0.6'),
  seed: 'study2-event-contract-fixture',
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
  ) => {
    events.push({
      schemaVersion: 'study2-event-v1',
      protocolVersion: 'study2-protocol-v1',
      sessionId: 'session-fixture-01',
      participantId: 'participant-fixture-01',
      participantIndex: 0,
      materialVersion: allocation.materialVersion,
      allocationSeed: allocation.seed,
      eventIndex: events.length,
      timestamp: new Date(Date.UTC(2026, 7, 2, 16, 0, events.length)).toISOString(),
      eventType,
      context,
      payload,
    });
  };
  add('session_started', null, { recruitmentSource: 'local_test' });
  add('comprehension_attempt', null, { attempt: 1, passed: true });
  add('participant_profile', null, {
    ageBracket: '25-34',
    gender: 'prefer_not_to_say',
    aiFamiliarity: 4,
    exerciseExpertise: 3,
  });
  for (const assignment of assignments) {
    const context = contextFor(assignment);
    add('trial_started', context, {
      answerVariantId: `${assignment.scenarioId}:${assignment.failureFamily}:${assignment.accuracy}`,
      answerVariantVersion: 'study2-answer-variants-v1',
      interventionCardId: `${assignment.scenarioId}:${assignment.interventionType}`,
      interventionCardVersion: 'study2-intervention-cards-v1',
      recognitionProbeScheduled: probes.has(assignment.trialIndex),
    });
    add('initial_response', context, {
      decision: 'option_a', confidence: 60, familiarity: 3, phaseDurationMs: 4_000,
    });
    add('ai_answer_shown', context, {});
    add('intervention_shown', context, { aiReadingDurationMs: 5_000 });
    add('post_ai_probability', context, {
      probabilityAiCorrect: 70, interventionReadingDurationMs: 4_500,
    });
    add('final_response', context, {
      decision: 'option_b', confidence: 75, phaseDurationMs: 2_500,
    });
    if (probes.has(assignment.trialIndex)) {
      add('recognition_probe', context, {
        emphasis: 'numerical_support', phaseDurationMs: 1_500,
      });
    }
    add('trial_completed', context, { totalTrialDurationMs: 17_500 });
  }
  add('post_task_response', null, {
    numericalCardRelevance: 5,
    boundaryCardRelevance: 5,
    attentionCheckPassed: true,
  });
  add('session_completed', null, {});
  return events;
}

test('complete Study 2 trace follows all 16 trials and four deterministic probes', () => {
  const trace = completeTrace();
  const audit = auditStudy2Session({ events: trace, allocation, participantIndex: 0 });
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.completedTrials, 16);
  assert.equal(audit.recognitionProbes, 4);
  assert.equal(new Set(selectRecognitionProbeTrials(allocation.seed, 0)).size, 4);
  assert.deepEqual(
    selectRecognitionProbeTrials(allocation.seed, 0),
    selectRecognitionProbeTrials(allocation.seed, 0),
  );
});

test('event whitelist rejects ground-truth and author-label leakage', () => {
  const event = completeTrace().find((candidate) => candidate.eventType === 'trial_started')!;
  const leaked = {
    ...event,
    payload: { ...event.payload, groundTruth: 'option_a', provisionalCorrectOption: 'option_a' },
  };
  const validation = validateStudy2Event(leaked);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /Unexpected trial_started payload fields/);
});

test('session audit rejects omitted probes, phase reordering, and allocation drift', () => {
  const missingProbe = completeTrace();
  missingProbe.splice(
    missingProbe.findIndex((event) => event.eventType === 'recognition_probe'),
    1,
  );
  missingProbe.forEach((event, index) => { event.eventIndex = index; });
  assert.equal(auditStudy2Session({ events: missingProbe, allocation, participantIndex: 0 }).valid, false);

  const reordered = completeTrace();
  const initialIndex = reordered.findIndex((event) => event.eventType === 'initial_response');
  [reordered[initialIndex], reordered[initialIndex + 1]] = [reordered[initialIndex + 1], reordered[initialIndex]];
  reordered.forEach((event, index) => { event.eventIndex = index; });
  assert.match(
    auditStudy2Session({ events: reordered, allocation, participantIndex: 0 }).errors.join('\n'),
    /frozen (?:event sequence|global procedure order)/,
  );

  const drifted = completeTrace();
  const trialEvent = drifted.find((event) => event.context)!;
  trialEvent.context = { ...trialEvent.context!, scenarioId: 'wrong-scenario' };
  assert.match(
    auditStudy2Session({ events: drifted, allocation, participantIndex: 0 }).errors.join('\n'),
    /context does not match allocation/,
  );
});

test('malformed event JSON fails without throwing', () => {
  assert.deepEqual(validateStudy2Event(null), {
    valid: false,
    errors: ['Study 2 event must be a JSON object.'],
  });
  const audit = auditStudy2Session({ events: [null, {}], allocation, participantIndex: 0 });
  assert.equal(audit.valid, false);
  assert.equal(audit.completedTrials, 0);
});

test('validated event prefixes derive the only permissible recovery step', () => {
  const trace = completeTrace();
  const interventionIndex = trace.findIndex(
    (event) => event.eventType === 'intervention_shown' && event.context?.trialIndex === 3,
  );
  const prefix = trace.slice(0, interventionIndex + 1);
  const audit = auditStudy2SessionPrefix({ events: prefix, allocation, participantIndex: 0 });
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.nextEventType, 'post_ai_probability');
  assert.equal(audit.nextTrialIndex, 3);

  const skipped = [...prefix];
  skipped.splice(skipped.findIndex((event) => event.eventType === 'initial_response'), 1);
  skipped.forEach((event, index) => { event.eventIndex = index; });
  const invalid = auditStudy2SessionPrefix({ events: skipped, allocation, participantIndex: 0 });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.nextEventType, null);
  assert.match(invalid.errors.join('\n'), /not the next event in the frozen procedure/);
});
