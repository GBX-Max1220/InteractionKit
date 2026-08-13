import type { Study2RunnerStep } from './runner-machine';
import type { Study2EventType } from './events';

export type Study2ParticipantAction =
  | { action: 'consent'; consented: true }
  | { action: 'submit_comprehension'; attempt: 1 | 2; initialDecisionTiming: 'before_ai' | 'after_ai'; trialFeedback: 'no_ground_truth' | 'ground_truth'; confidenceDistinction: 'different_judgments' | 'same_judgment' }
  | { action: 'submit_profile'; ageBracket: string; gender: string; aiFamiliarity: number; exerciseExpertise: number }
  | { action: 'start_trial' }
  | { action: 'submit_initial_response'; decision: 'option_a' | 'option_b'; confidence: number; familiarity: number; phaseDurationMs: number }
  | { action: 'show_ai_answer' }
  | { action: 'show_evidence_check'; aiReadingDurationMs: number }
  | { action: 'submit_ai_probability'; probabilityAiCorrect: number; interventionReadingDurationMs: number }
  | { action: 'submit_final_response'; decision: 'option_a' | 'option_b'; confidence: number; phaseDurationMs: number }
  | { action: 'submit_recognition_probe'; emphasis: 'numerical_support' | 'applicability_boundary' | 'unsure'; phaseDurationMs: number }
  | { action: 'complete_trial'; totalTrialDurationMs: number }
  | { action: 'submit_post_task'; numericalCardRelevance: number; boundaryCardRelevance: number; attentionResponse: 'select_passed' | 'other' }
  | { action: 'complete_session' }
  | { action: 'terminate_after_comprehension' };

export interface Study2PublicRuntimeView {
  schemaVersion: 'study2-public-runtime-view-v1';
  phase: Study2RunnerStep['phase'];
  trialIndex: number | null;
  totalTrials: 16;
  comprehensionAttempt: 1 | 2 | null;
  completionStatus: 'in_progress' | 'completed' | 'terminated';
  trial: Study2RunnerStep['trial'];
}

export interface Study2MappedParticipantAction {
  eventType: Study2EventType;
  payload: Record<string, unknown>;
}

const ACTION_FOR_PHASE: Record<Exclude<Study2RunnerStep['phase'], 'completed'>, Study2ParticipantAction['action']> = {
  consent: 'consent',
  comprehension: 'submit_comprehension',
  participant_profile: 'submit_profile',
  trial_transition: 'start_trial',
  initial_response: 'submit_initial_response',
  ai_answer_transition: 'show_ai_answer',
  ai_answer_reading: 'show_evidence_check',
  post_ai_probability: 'submit_ai_probability',
  final_response: 'submit_final_response',
  recognition_probe: 'submit_recognition_probe',
  trial_completion: 'complete_trial',
  post_task_response: 'submit_post_task',
  session_completion: 'complete_session',
  session_termination: 'terminate_after_comprehension',
};

const ACTION_KEYS: Record<Study2ParticipantAction['action'], readonly string[]> = {
  consent: ['action', 'consented'],
  submit_comprehension: ['action', 'attempt', 'initialDecisionTiming', 'trialFeedback', 'confidenceDistinction'],
  submit_profile: ['action', 'ageBracket', 'gender', 'aiFamiliarity', 'exerciseExpertise'],
  start_trial: ['action'],
  submit_initial_response: ['action', 'decision', 'confidence', 'familiarity', 'phaseDurationMs'],
  show_ai_answer: ['action'],
  show_evidence_check: ['action', 'aiReadingDurationMs'],
  submit_ai_probability: ['action', 'probabilityAiCorrect', 'interventionReadingDurationMs'],
  submit_final_response: ['action', 'decision', 'confidence', 'phaseDurationMs'],
  submit_recognition_probe: ['action', 'emphasis', 'phaseDurationMs'],
  complete_trial: ['action', 'totalTrialDurationMs'],
  submit_post_task: ['action', 'numericalCardRelevance', 'boundaryCardRelevance', 'attentionResponse'],
  complete_session: ['action'],
  terminate_after_comprehension: ['action'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function integerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function duration(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function deriveStudy2PublicRuntimeView(step: Study2RunnerStep, options: {
  comprehensionAttempt?: 1 | 2 | null;
  completionStatus?: Study2PublicRuntimeView['completionStatus'];
} = {}): Study2PublicRuntimeView {
  const serialized = JSON.stringify(step.trial);
  for (const forbidden of [
    'variantId', 'cardId', 'citationSourceId', 'scenarioId', 'failureFamily',
    'interventionType', 'accuracy', 'supportLevel', 'matchStatus', 'finalBinaryDecision',
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`Participant runtime view contains forbidden field ${forbidden}.`);
  }
  return {
    schemaVersion: 'study2-public-runtime-view-v1',
    phase: step.phase,
    trialIndex: step.trialIndex,
    totalTrials: 16,
    comprehensionAttempt: options.comprehensionAttempt ?? null,
    completionStatus: options.completionStatus ?? 'in_progress',
    trial: structuredClone(step.trial),
  };
}

export function mapStudy2ParticipantAction(options: {
  step: Study2RunnerStep;
  value: unknown;
  recruitmentSource: string;
}): Study2MappedParticipantAction {
  if (options.step.phase === 'completed') throw new Error('Completed sessions accept no participant actions.');
  if (!isRecord(options.value) || typeof options.value.action !== 'string') throw new Error('Participant action must be a typed object.');
  const action = options.value.action as Study2ParticipantAction['action'];
  if (!(action in ACTION_KEYS)) throw new Error('Participant action type is unknown.');
  if (!exactKeys(options.value, ACTION_KEYS[action])) throw new Error(`Participant action ${action} contains missing or unexpected fields.`);
  if (ACTION_FOR_PHASE[options.step.phase] !== action) throw new Error(`Phase ${options.step.phase} does not accept action ${action}.`);
  const value = options.value;
  switch (action) {
    case 'consent':
      if (value.consented !== true || !options.recruitmentSource.trim()) throw new Error('Consent and server-known recruitment source are required.');
      return { eventType: 'session_started', payload: { recruitmentSource: options.recruitmentSource } };
    case 'submit_comprehension': {
      if (![1, 2].includes(Number(value.attempt))) throw new Error('Comprehension attempt must be 1 or 2.');
      const passed = value.initialDecisionTiming === 'before_ai' && value.trialFeedback === 'no_ground_truth' && value.confidenceDistinction === 'different_judgments';
      return { eventType: 'comprehension_attempt', payload: { attempt: value.attempt, passed } };
    }
    case 'submit_profile':
      if (typeof value.ageBracket !== 'string' || !value.ageBracket.trim() || typeof value.gender !== 'string' || !value.gender.trim() || !integerInRange(value.aiFamiliarity, 1, 5) || !integerInRange(value.exerciseExpertise, 1, 5)) throw new Error('Participant profile is incomplete.');
      return { eventType: 'participant_profile', payload: { ageBracket: value.ageBracket, gender: value.gender, aiFamiliarity: value.aiFamiliarity, exerciseExpertise: value.exerciseExpertise } };
    case 'start_trial': return { eventType: 'trial_started', payload: {} };
    case 'submit_initial_response':
      if (!['option_a', 'option_b'].includes(String(value.decision)) || !integerInRange(value.confidence, 0, 100) || !integerInRange(value.familiarity, 1, 5) || !duration(value.phaseDurationMs)) throw new Error('Initial response is invalid.');
      return { eventType: 'initial_response', payload: { decision: value.decision, confidence: value.confidence, familiarity: value.familiarity, phaseDurationMs: value.phaseDurationMs } };
    case 'show_ai_answer': return { eventType: 'ai_answer_shown', payload: {} };
    case 'show_evidence_check':
      if (!duration(value.aiReadingDurationMs)) throw new Error('AI reading duration is invalid.');
      return { eventType: 'intervention_shown', payload: { aiReadingDurationMs: value.aiReadingDurationMs } };
    case 'submit_ai_probability':
      if (!integerInRange(value.probabilityAiCorrect, 0, 100) || !duration(value.interventionReadingDurationMs)) throw new Error('Post-AI probability response is invalid.');
      return { eventType: 'post_ai_probability', payload: { probabilityAiCorrect: value.probabilityAiCorrect, interventionReadingDurationMs: value.interventionReadingDurationMs } };
    case 'submit_final_response':
      if (!['option_a', 'option_b'].includes(String(value.decision)) || !integerInRange(value.confidence, 0, 100) || !duration(value.phaseDurationMs)) throw new Error('Final response is invalid.');
      return { eventType: 'final_response', payload: { decision: value.decision, confidence: value.confidence, phaseDurationMs: value.phaseDurationMs } };
    case 'submit_recognition_probe':
      if (!['numerical_support', 'applicability_boundary', 'unsure'].includes(String(value.emphasis)) || !duration(value.phaseDurationMs)) throw new Error('Recognition response is invalid.');
      return { eventType: 'recognition_probe', payload: { emphasis: value.emphasis, phaseDurationMs: value.phaseDurationMs } };
    case 'complete_trial':
      if (!duration(value.totalTrialDurationMs)) throw new Error('Total trial duration is invalid.');
      return { eventType: 'trial_completed', payload: { totalTrialDurationMs: value.totalTrialDurationMs } };
    case 'submit_post_task':
      if (!integerInRange(value.numericalCardRelevance, 1, 7) || !integerInRange(value.boundaryCardRelevance, 1, 7) || !['select_passed', 'other'].includes(String(value.attentionResponse))) throw new Error('Post-task response is invalid.');
      return { eventType: 'post_task_response', payload: { numericalCardRelevance: value.numericalCardRelevance, boundaryCardRelevance: value.boundaryCardRelevance, attentionCheckPassed: value.attentionResponse === 'select_passed' } };
    case 'complete_session': return { eventType: 'session_completed', payload: {} };
    case 'terminate_after_comprehension': return { eventType: 'session_terminated', payload: { reason: 'comprehension_failed' } };
  }
}
