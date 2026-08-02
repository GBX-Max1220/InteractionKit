import { seededShuffle } from './random';
import { auditAllocation } from './schedule';
import type { Study2Allocation, Study2TrialAssignment } from './types';

export const STUDY2_EVENT_TYPES = [
  'session_started',
  'comprehension_attempt',
  'participant_profile',
  'trial_started',
  'initial_response',
  'ai_answer_shown',
  'intervention_shown',
  'post_ai_probability',
  'final_response',
  'recognition_probe',
  'trial_completed',
  'post_task_response',
  'session_completed',
] as const;

export type Study2EventType = (typeof STUDY2_EVENT_TYPES)[number];

export interface Study2TrialContext {
  trialIndex: number;
  scenarioId: string;
  failureFamily: Study2TrialAssignment['failureFamily'];
  interventionType: Study2TrialAssignment['interventionType'];
  accuracy: Study2TrialAssignment['accuracy'];
  displayedConfidence: Study2TrialAssignment['confidence'];
  supportLevel: Study2TrialAssignment['supportLevel'];
  matchStatus: Study2TrialAssignment['matchStatus'];
}

export interface Study2Event {
  schemaVersion: 'study2-event-v1';
  protocolVersion: 'study2-protocol-v1';
  sessionId: string;
  participantId: string;
  participantIndex: number;
  materialVersion: string;
  allocationSeed: string;
  eventIndex: number;
  timestamp: string;
  eventType: Study2EventType;
  context: Study2TrialContext | null;
  payload: Record<string, unknown>;
}

export interface Study2SessionAudit {
  valid: boolean;
  errors: string[];
  eventCount: number;
  completedTrials: number;
  recognitionProbes: number;
}

export interface Study2SessionPrefixAudit {
  valid: boolean;
  errors: string[];
  nextEventType: Study2EventType | null;
  nextTrialIndex: number | null;
}

const commonKeys = new Set([
  'schemaVersion',
  'protocolVersion',
  'sessionId',
  'participantId',
  'participantIndex',
  'materialVersion',
  'allocationSeed',
  'eventIndex',
  'timestamp',
  'eventType',
  'context',
  'payload',
]);
const contextKeys = new Set([
  'trialIndex',
  'scenarioId',
  'failureFamily',
  'interventionType',
  'accuracy',
  'displayedConfidence',
  'supportLevel',
  'matchStatus',
]);
const payloadKeys: Record<Study2EventType, Set<string>> = {
  session_started: new Set(['recruitmentSource']),
  comprehension_attempt: new Set(['attempt', 'passed']),
  participant_profile: new Set(['ageBracket', 'gender', 'aiFamiliarity', 'exerciseExpertise']),
  trial_started: new Set([
    'answerVariantId',
    'answerVariantVersion',
    'interventionCardId',
    'interventionCardVersion',
    'recognitionProbeScheduled',
  ]),
  initial_response: new Set(['decision', 'confidence', 'familiarity', 'phaseDurationMs']),
  ai_answer_shown: new Set([]),
  intervention_shown: new Set(['aiReadingDurationMs']),
  post_ai_probability: new Set(['probabilityAiCorrect', 'interventionReadingDurationMs']),
  final_response: new Set(['decision', 'confidence', 'phaseDurationMs']),
  recognition_probe: new Set(['emphasis', 'phaseDurationMs']),
  trial_completed: new Set(['totalTrialDurationMs']),
  post_task_response: new Set([
    'numericalCardRelevance',
    'boundaryCardRelevance',
    'attentionCheckPassed',
  ]),
  session_completed: new Set([]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function inRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function nonNegativeDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function unexpectedKeys(value: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function validateContext(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['Trial event context must be an object.'];
  const unexpected = unexpectedKeys(value, contextKeys);
  if (unexpected.length) errors.push(`Unexpected trial-context fields: ${unexpected.join(', ')}.`);
  if (!Number.isInteger(value.trialIndex) || Number(value.trialIndex) < 0 || Number(value.trialIndex) > 15) errors.push('Trial index must be 0-15.');
  if (!nonEmptyString(value.scenarioId)) errors.push('Trial context requires scenarioId.');
  if (!['unsupported_numerical_precision', 'omitted_decision_boundary'].includes(String(value.failureFamily))) errors.push('Invalid failure family.');
  if (!['numerical_warrant_card', 'boundary_condition_card'].includes(String(value.interventionType))) errors.push('Invalid intervention type.');
  if (!['correct', 'incorrect'].includes(String(value.accuracy))) errors.push('Invalid answer accuracy.');
  if (![65, 85].includes(Number(value.displayedConfidence))) errors.push('Displayed confidence must be 65 or 85.');
  if (!['strong_consensus', 'mixed_or_conditional'].includes(String(value.supportLevel))) errors.push('Invalid support level.');
  if (!['matched', 'mismatched'].includes(String(value.matchStatus))) errors.push('Invalid match status.');
  return errors;
}

function validatePayload(eventType: Study2EventType, value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return [`${eventType} payload must be an object.`];
  const unexpected = unexpectedKeys(value, payloadKeys[eventType]);
  if (unexpected.length) errors.push(`Unexpected ${eventType} payload fields: ${unexpected.join(', ')}.`);
  const requiredStrings: Partial<Record<Study2EventType, string[]>> = {
    session_started: ['recruitmentSource'],
    participant_profile: ['ageBracket', 'gender'],
    trial_started: ['answerVariantId', 'answerVariantVersion', 'interventionCardId', 'interventionCardVersion'],
  };
  for (const field of requiredStrings[eventType] ?? []) {
    if (!nonEmptyString(value[field])) errors.push(`${eventType} requires ${field}.`);
  }
  if (eventType === 'comprehension_attempt') {
    if (![1, 2].includes(Number(value.attempt))) errors.push('Comprehension attempt must be 1 or 2.');
    if (typeof value.passed !== 'boolean') errors.push('Comprehension attempt requires passed boolean.');
  }
  if (eventType === 'participant_profile') {
    if (!inRange(value.aiFamiliarity, 1, 5) || !Number.isInteger(value.aiFamiliarity)) errors.push('AI familiarity must be an integer 1-5.');
    if (!inRange(value.exerciseExpertise, 1, 5) || !Number.isInteger(value.exerciseExpertise)) errors.push('Exercise expertise must be an integer 1-5.');
  }
  if (eventType === 'trial_started' && typeof value.recognitionProbeScheduled !== 'boolean') errors.push('Trial start requires recognitionProbeScheduled boolean.');
  if (eventType === 'initial_response' || eventType === 'final_response') {
    if (!['option_a', 'option_b'].includes(String(value.decision))) errors.push(`${eventType} requires a binary decision.`);
    if (!inRange(value.confidence, 0, 100)) errors.push(`${eventType} confidence must be 0-100.`);
    if (!nonNegativeDuration(value.phaseDurationMs)) errors.push(`${eventType} requires a nonnegative phase duration.`);
  }
  if (eventType === 'initial_response' && (!inRange(value.familiarity, 1, 5) || !Number.isInteger(value.familiarity))) errors.push('Initial response familiarity must be an integer 1-5.');
  if (eventType === 'intervention_shown' && !nonNegativeDuration(value.aiReadingDurationMs)) errors.push('Intervention display requires AI reading duration.');
  if (eventType === 'post_ai_probability') {
    if (!inRange(value.probabilityAiCorrect, 0, 100)) errors.push('AI-correct probability must be 0-100.');
    if (!nonNegativeDuration(value.interventionReadingDurationMs)) errors.push('Post-AI probability requires intervention reading duration.');
  }
  if (eventType === 'recognition_probe') {
    if (!['numerical_support', 'applicability_boundary', 'unsure'].includes(String(value.emphasis))) errors.push('Recognition probe has an invalid response.');
    if (!nonNegativeDuration(value.phaseDurationMs)) errors.push('Recognition probe requires a nonnegative phase duration.');
  }
  if (eventType === 'trial_completed' && !nonNegativeDuration(value.totalTrialDurationMs)) errors.push('Trial completion requires total duration.');
  if (eventType === 'post_task_response') {
    if (!inRange(value.numericalCardRelevance, 1, 7) || !Number.isInteger(value.numericalCardRelevance)) errors.push('Numerical-card relevance must be an integer 1-7.');
    if (!inRange(value.boundaryCardRelevance, 1, 7) || !Number.isInteger(value.boundaryCardRelevance)) errors.push('Boundary-card relevance must be an integer 1-7.');
    if (typeof value.attentionCheckPassed !== 'boolean') errors.push('Post-task response requires attention-check result.');
  }
  return errors;
}

export function validateStudy2Event(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Study 2 event must be a JSON object.'] };
  const unexpected = unexpectedKeys(value, commonKeys);
  if (unexpected.length) errors.push(`Unexpected event fields: ${unexpected.join(', ')}.`);
  if (value.schemaVersion !== 'study2-event-v1') errors.push('Unsupported event schema.');
  if (value.protocolVersion !== 'study2-protocol-v1') errors.push('Unsupported protocol version.');
  for (const field of ['sessionId', 'participantId', 'materialVersion', 'allocationSeed'] as const) {
    if (!nonEmptyString(value[field])) errors.push(`Event requires ${field}.`);
  }
  if (!Number.isInteger(value.participantIndex) || Number(value.participantIndex) < 0) errors.push('Participant index must be a nonnegative integer.');
  if (!Number.isInteger(value.eventIndex) || Number(value.eventIndex) < 0) errors.push('Event index must be a nonnegative integer.');
  if (!nonEmptyString(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp))) errors.push('Event requires a valid timestamp.');
  if (!STUDY2_EVENT_TYPES.includes(value.eventType as Study2EventType)) {
    errors.push('Unknown Study 2 event type.');
    return { valid: false, errors };
  }
  const eventType = value.eventType as Study2EventType;
  const trialEvent = [
    'trial_started', 'initial_response', 'ai_answer_shown', 'intervention_shown',
    'post_ai_probability', 'final_response', 'recognition_probe', 'trial_completed',
  ].includes(eventType);
  if (trialEvent) errors.push(...validateContext(value.context));
  else if (value.context !== null) errors.push(`${eventType} must not contain trial context.`);
  errors.push(...validatePayload(eventType, value.payload));
  return { valid: errors.length === 0, errors };
}

export function selectRecognitionProbeTrials(seed: string, participantIndex: number): number[] {
  return seededShuffle(
    Array.from({ length: 16 }, (_, index) => index),
    `${seed}:participant:${participantIndex}:recognition-probes`,
  ).slice(0, 4).sort((first, second) => first - second);
}

function contextMatchesAssignment(context: Study2TrialContext, assignment: Study2TrialAssignment): boolean {
  return (
    context.trialIndex === assignment.trialIndex &&
    context.scenarioId === assignment.scenarioId &&
    context.failureFamily === assignment.failureFamily &&
    context.interventionType === assignment.interventionType &&
    context.accuracy === assignment.accuracy &&
    context.displayedConfidence === assignment.confidence &&
    context.supportLevel === assignment.supportLevel &&
    context.matchStatus === assignment.matchStatus
  );
}

function sequenceForSession(
  assignments: Study2TrialAssignment[],
  recognitionProbeTrialIndices: number[],
  comprehensionAttempts: number,
): Array<{ eventType: Study2EventType; trialIndex: number | null }> {
  const sequence: Array<{ eventType: Study2EventType; trialIndex: number | null }> = [
    { eventType: 'session_started', trialIndex: null },
    ...Array.from({ length: comprehensionAttempts }, () => ({
      eventType: 'comprehension_attempt' as const,
      trialIndex: null,
    })),
    { eventType: 'participant_profile', trialIndex: null },
  ];
  for (const assignment of assignments) {
    for (const eventType of [
      'trial_started',
      'initial_response',
      'ai_answer_shown',
      'intervention_shown',
      'post_ai_probability',
      'final_response',
      ...(recognitionProbeTrialIndices.includes(assignment.trialIndex)
        ? ['recognition_probe' as const]
        : []),
      'trial_completed',
    ] as Study2EventType[]) {
      sequence.push({ eventType, trialIndex: assignment.trialIndex });
    }
  }
  sequence.push(
    { eventType: 'post_task_response', trialIndex: null },
    { eventType: 'session_completed', trialIndex: null },
  );
  return sequence;
}

export function auditStudy2SessionPrefix(options: {
  events: unknown[];
  allocation: Study2Allocation;
  participantIndex: number;
}): Study2SessionPrefixAudit {
  const errors: string[] = [];
  const allocationAudit = auditAllocation(options.allocation);
  if (!allocationAudit.valid) errors.push(...allocationAudit.errors.map((error) => `Allocation: ${error}`));
  const assignments = options.allocation.trials
    .filter((trial) => trial.participantIndex === options.participantIndex)
    .sort((first, second) => first.trialIndex - second.trialIndex);
  if (assignments.length !== 16) errors.push('Session prefix requires one complete participant allocation.');
  const events: Study2Event[] = [];
  for (const [index, value] of options.events.entries()) {
    const validation = validateStudy2Event(value);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `Event ${index}: ${error}`));
    else events.push(value as Study2Event);
  }
  if (events.length !== options.events.length) {
    return { valid: false, errors, nextEventType: null, nextTrialIndex: null };
  }
  const comprehension = events.filter((event) => event.eventType === 'comprehension_attempt');
  let expectedComprehensionAttempts = 1;
  if (comprehension[0]?.payload.passed === false) expectedComprehensionAttempts = 2;
  if (comprehension.length > 2) errors.push('Session prefix has more than two comprehension attempts.');
  if (comprehension[0]?.payload.passed === true && comprehension.length > 1) errors.push('Session prefix continues comprehension after a pass.');
  if (comprehension[1]?.payload.passed !== undefined && comprehension[1].payload.passed !== true) errors.push('A completed second comprehension attempt must pass before the study can continue.');
  comprehension.forEach((event, index) => {
    if (event.payload.attempt !== index + 1) errors.push('Session prefix has invalid comprehension numbering.');
  });
  const probes = assignments[0]
    ? selectRecognitionProbeTrials(options.allocation.seed, options.participantIndex)
    : [];
  const expected = sequenceForSession(assignments, probes, expectedComprehensionAttempts);
  if (events.length > expected.length) errors.push('Session prefix contains events after completion.');
  for (const [index, event] of events.entries()) {
    const expectedEvent = expected[index];
    if (!expectedEvent || event.eventType !== expectedEvent.eventType || event.context?.trialIndex !== expectedEvent.trialIndex && !(event.context === null && expectedEvent.trialIndex === null)) {
      errors.push(`Event ${index} is not the next event in the frozen procedure.`);
      continue;
    }
    if (event.eventIndex !== index) errors.push(`Event ${index} has a noncontiguous eventIndex.`);
    if (index > 0 && Date.parse(event.timestamp) < Date.parse(events[index - 1].timestamp)) errors.push(`Event ${index} timestamp precedes the previous event.`);
    if (index > 0) {
      for (const field of ['sessionId', 'participantId', 'participantIndex', 'materialVersion', 'allocationSeed'] as const) {
        if (event[field] !== events[0][field]) errors.push(`Event ${index} changes session field ${field}.`);
      }
    }
    if (event.context) {
      const assignment = assignments[event.context.trialIndex];
      if (!assignment || !contextMatchesAssignment(event.context, assignment)) errors.push(`Event ${index} context does not match allocation.`);
      if (
        event.eventType === 'trial_started' &&
        event.payload.recognitionProbeScheduled !== probes.includes(event.context.trialIndex)
      ) {
        errors.push(`Event ${index} has an incorrect recognition-probe schedule flag.`);
      }
    }
  }
  if (events[0]) {
    if (events[0].participantIndex !== options.participantIndex) errors.push('Session prefix participant index does not match allocation.');
    if (events[0].allocationSeed !== options.allocation.seed) errors.push('Session prefix seed does not match allocation.');
    if (events[0].materialVersion !== options.allocation.materialVersion) errors.push('Session prefix material version does not match allocation.');
  }
  const next = expected[events.length] ?? null;
  return {
    valid: errors.length === 0,
    errors,
    nextEventType: errors.length === 0 ? next?.eventType ?? null : null,
    nextTrialIndex: errors.length === 0 ? next?.trialIndex ?? null : null,
  };
}

export function auditStudy2Session(options: {
  events: unknown[];
  allocation: Study2Allocation;
  participantIndex: number;
}): Study2SessionAudit {
  const errors: string[] = [];
  const prefixAudit = auditStudy2SessionPrefix(options);
  errors.push(...prefixAudit.errors);
  const events: Study2Event[] = [];
  for (const [index, value] of options.events.entries()) {
    const validation = validateStudy2Event(value);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `Event ${index}: ${error}`));
    else events.push(value as Study2Event);
  }
  if (events.length !== options.events.length) {
    return { valid: false, errors, eventCount: options.events.length, completedTrials: 0, recognitionProbes: 0 };
  }
  const allocationAudit = auditAllocation(options.allocation);
  if (!allocationAudit.valid) {
    errors.push(...allocationAudit.errors.map((error) => `Allocation: ${error}`));
  }
  const assignments = options.allocation.trials
    .filter((trial) => trial.participantIndex === options.participantIndex)
    .sort((a, b) => a.trialIndex - b.trialIndex);
  if (assignments.length !== 16 || assignments.some((assignment, index) => assignment.trialIndex !== index)) errors.push('Session audit requires one participant allocation with trial indices 0-15.');
  if (
    assignments.some(
      (assignment) =>
        assignment.participantIndex !== assignments[0]?.participantIndex ||
        assignment.allocationSeed !== assignments[0]?.allocationSeed,
    )
  ) {
    errors.push('Session assignments must belong to one participant and allocation seed.');
  }
  const recognitionProbeTrialIndices = assignments[0]
    ? selectRecognitionProbeTrials(assignments[0].allocationSeed, assignments[0].participantIndex)
    : [];
  for (const [index, event] of events.entries()) {
    if (event.eventIndex !== index) errors.push(`Event ${index} has a noncontiguous eventIndex.`);
    if (index > 0 && Date.parse(event.timestamp) < Date.parse(events[index - 1].timestamp)) errors.push(`Event ${index} timestamp precedes the previous event.`);
    if (index > 0) {
      for (const field of ['sessionId', 'participantId', 'participantIndex', 'materialVersion', 'allocationSeed'] as const) {
        if (event[field] !== events[0][field]) errors.push(`Event ${index} changes session field ${field}.`);
      }
    }
  }
  if (events[0]?.eventType !== 'session_started') errors.push('First event must be session_started.');
  if (events.at(-1)?.eventType !== 'session_completed') errors.push('Last event must be session_completed.');
  if (events[0] && assignments[0]) {
    if (events[0].participantIndex !== assignments[0].participantIndex) errors.push('Session participant index does not match allocation.');
    if (events[0].allocationSeed !== options.allocation.seed) errors.push('Session allocation seed does not match allocation.');
    if (events[0].materialVersion !== options.allocation.materialVersion) errors.push('Session material version does not match allocation.');
  }
  const comprehension = events.filter((event) => event.eventType === 'comprehension_attempt');
  const passed = comprehension.findIndex((event) => event.payload.passed === true);
  if (comprehension.length < 1 || comprehension.length > 2 || passed < 0 || passed !== comprehension.length - 1) errors.push('Completed session requires comprehension passed on attempt 1 or 2, with no later attempt.');
  comprehension.forEach((event, index) => {
    if (event.payload.attempt !== index + 1) errors.push('Comprehension attempt numbering is invalid.');
  });
  if (events.filter((event) => event.eventType === 'participant_profile').length !== 1) errors.push('Completed session requires exactly one participant profile.');

  const expectedGlobalSequence: string[] = [
    'session_started',
    ...comprehension.map(() => 'comprehension_attempt'),
    'participant_profile',
  ];
  for (const assignment of assignments) {
    const probeExpected = recognitionProbeTrialIndices.includes(assignment.trialIndex);
    expectedGlobalSequence.push(
      `trial_started:${assignment.trialIndex}`,
      `initial_response:${assignment.trialIndex}`,
      `ai_answer_shown:${assignment.trialIndex}`,
      `intervention_shown:${assignment.trialIndex}`,
      `post_ai_probability:${assignment.trialIndex}`,
      `final_response:${assignment.trialIndex}`,
      ...(probeExpected ? [`recognition_probe:${assignment.trialIndex}`] : []),
      `trial_completed:${assignment.trialIndex}`,
    );
  }
  expectedGlobalSequence.push('post_task_response', 'session_completed');
  const observedGlobalSequence = events.map((event) =>
    event.context ? `${event.eventType}:${event.context.trialIndex}` : event.eventType,
  );
  if (JSON.stringify(observedGlobalSequence) !== JSON.stringify(expectedGlobalSequence)) {
    errors.push('Session events do not follow the frozen global procedure order.');
  }

  let completedTrials = 0;
  let recognitionProbes = 0;
  for (const assignment of assignments) {
    const trialEvents = events.filter((event) => event.context?.trialIndex === assignment.trialIndex);
    const probeExpected = recognitionProbeTrialIndices.includes(assignment.trialIndex);
    const expectedTypes: Study2EventType[] = [
      'trial_started', 'initial_response', 'ai_answer_shown', 'intervention_shown',
      'post_ai_probability', 'final_response',
      ...(probeExpected ? ['recognition_probe' as const] : []),
      'trial_completed',
    ];
    if (JSON.stringify(trialEvents.map((event) => event.eventType)) !== JSON.stringify(expectedTypes)) errors.push(`Trial ${assignment.trialIndex} does not follow the frozen event sequence.`);
    for (const event of trialEvents) {
      if (!contextMatchesAssignment(event.context!, assignment)) errors.push(`Trial ${assignment.trialIndex} event context does not match allocation.`);
    }
    const trialStart = trialEvents.find((event) => event.eventType === 'trial_started');
    if (trialStart?.payload.recognitionProbeScheduled !== probeExpected) errors.push(`Trial ${assignment.trialIndex} probe schedule flag is incorrect.`);
    if (trialEvents.some((event) => event.eventType === 'trial_completed')) completedTrials += 1;
    recognitionProbes += trialEvents.filter((event) => event.eventType === 'recognition_probe').length;
  }
  if (events.filter((event) => event.eventType === 'post_task_response').length !== 1) errors.push('Completed session requires one post-task response.');
  if (events.filter((event) => event.eventType === 'session_completed').length !== 1) errors.push('Completed session requires exactly one session_completed event.');
  return { valid: errors.length === 0, errors, eventCount: events.length, completedTrials, recognitionProbes };
}
