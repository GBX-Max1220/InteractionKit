import {
  deliveryCardId,
  deliveryVariantId,
  type Study2DeliveryMaterials,
} from './delivery-materials';
import {
  auditStudy2SessionStore,
  appendStudy2Event,
  type Study2SessionStore,
} from './session-store';
import {
  selectRecognitionProbeTrials,
  type Study2Event,
  type Study2EventType,
  type Study2TrialContext,
} from './events';
import type { FrozenStudy2MaterialsArtifact } from './frozen-materials';
import type { Study2Allocation, Study2TrialAssignment } from './types';

export interface Study2SessionIdentity {
  sessionId: string;
  participantId: string;
  participantIndex: number;
}

export type Study2RunnerPhase =
  | 'consent'
  | 'comprehension'
  | 'participant_profile'
  | 'trial_transition'
  | 'initial_response'
  | 'ai_answer_transition'
  | 'ai_answer_reading'
  | 'post_ai_probability'
  | 'final_response'
  | 'recognition_probe'
  | 'trial_completion'
  | 'post_task_response'
  | 'session_completion'
  | 'session_termination'
  | 'completed';

export interface Study2ParticipantTrialView {
  trialIndex: number;
  totalTrials: 16;
  decisionPrompt: string;
  optionA: string;
  optionB: string;
  targetPopulation: string;
  answerText: string;
  displayedConfidence: 65 | 85;
  interventionCard: { rows: { label: string; text: string }[] };
}

export interface Study2RunnerStep {
  phase: Study2RunnerPhase;
  nextEventType: Study2EventType | null;
  trialIndex: number | null;
  trial: Study2ParticipantTrialView | null;
}

const PHASE_FOR_NEXT_EVENT: Record<Study2EventType, Study2RunnerPhase> = {
  session_started: 'consent',
  comprehension_attempt: 'comprehension',
  participant_profile: 'participant_profile',
  trial_started: 'trial_transition',
  initial_response: 'initial_response',
  ai_answer_shown: 'ai_answer_transition',
  intervention_shown: 'ai_answer_reading',
  post_ai_probability: 'post_ai_probability',
  final_response: 'final_response',
  recognition_probe: 'recognition_probe',
  trial_completed: 'trial_completion',
  post_task_response: 'post_task_response',
  session_completed: 'session_completion',
  session_terminated: 'session_termination',
};

function nonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required.`);
}

function validateRunnerMaterialVersions(
  allocation: Study2Allocation,
  bundle: Study2DeliveryMaterials,
  frozen: FrozenStudy2MaterialsArtifact,
): void {
  if (
    bundle.frozenMaterialVersion !== allocation.materialVersion ||
    frozen.materialVersion !== allocation.materialVersion ||
    bundle.frozenMaterialVersion !== frozen.materialVersion
  ) throw new Error('Runner material versions do not match the allocation.');
}

function assignmentFor(
  allocation: Study2Allocation,
  participantIndex: number,
  trialIndex: number,
): Study2TrialAssignment {
  const assignment = allocation.trials.find(
    (trial) => trial.participantIndex === participantIndex && trial.trialIndex === trialIndex,
  );
  if (!assignment) throw new Error(`Allocation is missing participant ${participantIndex}, trial ${trialIndex}.`);
  return assignment;
}

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

export function resolveStudy2ParticipantTrial(options: {
  allocation: Study2Allocation;
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
  participantIndex: number;
  trialIndex: number;
}): Study2ParticipantTrialView {
  validateRunnerMaterialVersions(options.allocation, options.bundle, options.frozen);
  const assignment = assignmentFor(options.allocation, options.participantIndex, options.trialIndex);
  const frozen = options.frozen.items.find((item) => item.candidateId === assignment.scenarioId);
  const variantId = deliveryVariantId(assignment.scenarioId, assignment.failureFamily, assignment.accuracy);
  const variant = options.bundle.variants.find((item) => item.variantId === variantId);
  const card = variant?.cards.find((item) => item.interventionType === assignment.interventionType);
  if (!frozen || !variant || !card) throw new Error(`Runner cannot resolve frozen participant material for trial ${options.trialIndex}.`);
  if (
    variant.scenarioId !== assignment.scenarioId ||
    variant.failureFamily !== assignment.failureFamily ||
    variant.accuracy !== assignment.accuracy ||
    !variant.answerText.trim() ||
    card.rows.length !== 3 ||
    card.rows.some((row) => !row.label.trim() || !row.text.trim())
  ) throw new Error(`Runner material identity or participant-visible content is invalid for trial ${options.trialIndex}.`);
  return {
    trialIndex: assignment.trialIndex,
    totalTrials: 16,
    decisionPrompt: frozen.decisionPrompt,
    optionA: frozen.optionA,
    optionB: frozen.optionB,
    targetPopulation: frozen.targetPopulation,
    answerText: variant.answerText,
    displayedConfidence: assignment.confidence,
    interventionCard: { rows: structuredClone(card.rows) },
  };
}

export async function deriveStudy2RunnerStep(options: {
  store: Study2SessionStore;
  allocation: Study2Allocation;
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
}): Promise<Study2RunnerStep> {
  validateRunnerMaterialVersions(options.allocation, options.bundle, options.frozen);
  const audit = await auditStudy2SessionStore(options.store, options.allocation);
  if (!audit.valid) throw new Error(`Cannot derive runner state from invalid storage:\n${audit.errors.join('\n')}`);
  if (audit.nextEventType === null) return { phase: 'completed', nextEventType: null, trialIndex: null, trial: null };
  const trial = audit.nextTrialIndex === null
    ? null
    : resolveStudy2ParticipantTrial({ ...options, participantIndex: options.store.participantIndex, trialIndex: audit.nextTrialIndex });
  return {
    phase: PHASE_FOR_NEXT_EVENT[audit.nextEventType],
    nextEventType: audit.nextEventType,
    trialIndex: audit.nextTrialIndex,
    trial,
  };
}

export async function appendStudy2RunnerEvent(options: {
  store: Study2SessionStore;
  allocation: Study2Allocation;
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
  identity: Study2SessionIdentity;
  eventType: Study2EventType;
  payload: Record<string, unknown>;
  timestamp: string;
}): Promise<Study2SessionStore> {
  for (const [value, label] of [[options.identity.sessionId, 'Session ID'], [options.identity.participantId, 'Participant ID']] as const) nonEmpty(value, label);
  if (options.identity.participantIndex !== options.store.participantIndex) throw new Error('Runner identity does not match the session store participant index.');
  if (!Number.isFinite(Date.parse(options.timestamp))) throw new Error('Runner event timestamp must be valid ISO-8601.');
  const step = await deriveStudy2RunnerStep(options);
  if (step.nextEventType !== options.eventType) {
    throw new Error(`Runner expected ${step.nextEventType ?? 'completion'}, not ${options.eventType}.`);
  }
  const trialEvent = step.trialIndex !== null;
  const assignment = trialEvent
    ? assignmentFor(options.allocation, options.identity.participantIndex, step.trialIndex!)
    : null;
  let payload = structuredClone(options.payload);
  if (options.eventType === 'trial_started') {
    resolveStudy2ParticipantTrial({ ...options, participantIndex: options.identity.participantIndex, trialIndex: step.trialIndex! });
    const variantId = deliveryVariantId(assignment!.scenarioId, assignment!.failureFamily, assignment!.accuracy);
    payload = {
      answerVariantId: variantId,
      answerVariantVersion: options.bundle.answerVariantVersion,
      interventionCardId: deliveryCardId(variantId, assignment!.interventionType),
      interventionCardVersion: options.bundle.interventionCardVersion,
      recognitionProbeScheduled: selectRecognitionProbeTrials(options.allocation.seed, options.identity.participantIndex).includes(step.trialIndex!),
    };
  }
  const event: Study2Event = {
    schemaVersion: 'study2-event-v1',
    protocolVersion: 'study2-protocol-v1',
    sessionId: options.identity.sessionId,
    participantId: options.identity.participantId,
    participantIndex: options.identity.participantIndex,
    materialVersion: options.allocation.materialVersion,
    allocationSeed: options.allocation.seed,
    eventIndex: options.store.records.length,
    timestamp: options.timestamp,
    eventType: options.eventType,
    context: assignment ? contextFor(assignment) : null,
    payload,
  };
  return appendStudy2Event({ store: options.store, event, allocation: options.allocation });
}
