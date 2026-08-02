import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveStudy2PublicRuntimeView,
  mapStudy2ParticipantAction,
} from '../src/study2/runtime-boundary';
import type { Study2RunnerStep } from '../src/study2/runner-machine';

const visibleTrial = {
  trialIndex: 0,
  totalTrials: 16 as const,
  decisionPrompt: 'Which option is better?',
  optionA: 'Option A text.',
  optionB: 'Option B text.',
  targetPopulation: 'Adults',
  answerText: 'Participant-visible answer.',
  displayedConfidence: 65 as const,
  interventionCard: { rows: [
    { label: 'First label', text: 'First evidence row.' },
    { label: 'Second label', text: 'Second evidence row.' },
    { label: 'Source', text: 'Citation text.' },
  ] },
};

function step(phase: Study2RunnerStep['phase']): Study2RunnerStep {
  return {
    phase,
    nextEventType: phase === 'initial_response' ? 'initial_response' : null,
    trialIndex: phase.includes('trial') || ['initial_response', 'ai_answer_reading', 'post_ai_probability', 'final_response', 'recognition_probe'].includes(phase) ? 0 : null,
    trial: ['consent', 'comprehension', 'participant_profile', 'post_task_response', 'session_completion', 'session_termination', 'completed'].includes(phase) ? null : visibleTrial,
  };
}

test('public runtime view contains visible content but no internal allocation/material identities', () => {
  const view = deriveStudy2PublicRuntimeView(step('initial_response'));
  const serialized = JSON.stringify(view);
  assert.match(serialized, /Participant-visible answer/);
  for (const forbidden of ['variantId', 'cardId', 'citationSourceId', 'scenarioId', 'failureFamily', 'interventionType', 'accuracy', 'supportLevel', 'matchStatus', 'finalBinaryDecision']) {
    assert.equal(serialized.includes(forbidden), false, `public runtime view leaked ${forbidden}`);
  }
});

test('server boundary computes comprehension and attention outcomes instead of trusting client booleans', () => {
  const comprehension = mapStudy2ParticipantAction({
    step: step('comprehension'),
    recruitmentSource: 'prolific',
    value: { action: 'submit_comprehension', attempt: 1, initialDecisionTiming: 'before_ai', trialFeedback: 'no_ground_truth', confidenceDistinction: 'different_judgments' },
  });
  assert.deepEqual(comprehension, { eventType: 'comprehension_attempt', payload: { attempt: 1, passed: true } });
  const attention = mapStudy2ParticipantAction({
    step: step('post_task_response'),
    recruitmentSource: 'prolific',
    value: { action: 'submit_post_task', numericalCardRelevance: 5, boundaryCardRelevance: 6, attentionResponse: 'other' },
  });
  assert.equal(attention.payload.attentionCheckPassed, false);
});

test('boundary rejects phase skipping, extra hidden fields, and client-authored outcome flags', () => {
  assert.throws(
    () => mapStudy2ParticipantAction({ step: step('initial_response'), recruitmentSource: 'prolific', value: { action: 'show_ai_answer' } }),
    /does not accept action/,
  );
  assert.throws(
    () => mapStudy2ParticipantAction({ step: step('comprehension'), recruitmentSource: 'prolific', value: { action: 'submit_comprehension', attempt: 1, initialDecisionTiming: 'before_ai', trialFeedback: 'no_ground_truth', confidenceDistinction: 'different_judgments', passed: true } }),
    /missing or unexpected fields/,
  );
  assert.throws(
    () => mapStudy2ParticipantAction({ step: step('initial_response'), recruitmentSource: 'prolific', value: { action: 'submit_initial_response', decision: 'option_a', confidence: 50, familiarity: 3, phaseDurationMs: 100, groundTruth: 'option_a' } }),
    /missing or unexpected fields/,
  );
});
