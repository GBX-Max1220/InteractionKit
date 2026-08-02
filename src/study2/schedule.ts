import {
  ACCURACY_LEVELS,
  AllocationAudit,
  CONFIDENCE_LEVELS,
  FAILURE_FAMILIES,
  INTERVENTION_TYPES,
  MatchStatus,
  Study2Allocation,
  Study2Condition,
  Study2ScenarioRef,
  Study2TrialAssignment,
  SUPPORT_LEVELS,
} from './types';
import { seededShuffle } from './random';

const TRIALS_PER_PARTICIPANT = 16;
const SCENARIOS_PER_SUPPORT_LEVEL = 12;
const MAX_CONSECUTIVE_SAME_LEVEL = 3;

function maximumRun<T>(values: T[]): number {
  let maximum = 0;
  let current = 0;
  let previous: T | undefined;
  for (const value of values) {
    current = value === previous ? current + 1 : 1;
    previous = value;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function validTrialOrder(trials: Study2TrialAssignment[]): boolean {
  const firstHalf = trials.slice(0, TRIALS_PER_PARTICIPANT / 2);
  const secondHalf = trials.slice(TRIALS_PER_PARTICIPANT / 2);
  return (
    maximumRun(trials.map((trial) => trial.accuracy)) <= MAX_CONSECUTIVE_SAME_LEVEL &&
    maximumRun(trials.map((trial) => trial.interventionType)) <=
      MAX_CONSECUTIVE_SAME_LEVEL &&
    firstHalf.filter((trial) => trial.matchStatus === 'matched').length === 4 &&
    secondHalf.filter((trial) => trial.matchStatus === 'matched').length === 4
  );
}

function constrainedTrialShuffle(
  trials: Study2TrialAssignment[],
  seed: string,
): Study2TrialAssignment[] {
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const randomized = seededShuffle(trials, `${seed}:attempt:${attempt}`);
    if (validTrialOrder(randomized)) return randomized;
  }
  throw new Error('Unable to satisfy the frozen Study 2 trial-order constraints.');
}

export function factorialConditions(): Study2Condition[] {
  const conditions: Study2Condition[] = [];
  for (const failureFamily of FAILURE_FAMILIES) {
    for (const accuracy of ACCURACY_LEVELS) {
      for (const confidence of CONFIDENCE_LEVELS) {
        for (const interventionType of INTERVENTION_TYPES) {
          conditions.push({ failureFamily, interventionType, accuracy, confidence });
        }
      }
    }
  }
  return conditions;
}

export function matchStatus(
  failureFamily: Study2Condition['failureFamily'],
  interventionType: Study2Condition['interventionType'],
): MatchStatus {
  const matched =
    (failureFamily === 'unsupported_numerical_precision' &&
      interventionType === 'numerical_warrant_card') ||
    (failureFamily === 'omitted_decision_boundary' &&
      interventionType === 'boundary_condition_card');
  return matched ? 'matched' : 'mismatched';
}

function validateScenarioPool(scenarios: Study2ScenarioRef[], materialVersion: string): void {
  const ids = new Set(scenarios.map((scenario) => scenario.id));
  if (ids.size !== scenarios.length) throw new Error('Scenario IDs must be unique.');
  if (scenarios.some((scenario) => scenario.materialVersion !== materialVersion)) {
    throw new Error('Every scenario must match the allocation material version.');
  }
  for (const supportLevel of SUPPORT_LEVELS) {
    const count = scenarios.filter((scenario) => scenario.supportLevel === supportLevel).length;
    if (count !== SCENARIOS_PER_SUPPORT_LEVEL) {
      throw new Error(`${supportLevel} requires exactly ${SCENARIOS_PER_SUPPORT_LEVEL} scenarios; received ${count}.`);
    }
  }
}

export function generateAllocation(options: {
  participants: number;
  scenarios: Study2ScenarioRef[];
  seed: string;
  materialVersion: string;
}): Study2Allocation {
  const { participants, scenarios, seed, materialVersion } = options;
  if (!Number.isInteger(participants) || participants <= 0 || participants % 24 !== 0) {
    throw new Error('Participant count must be a positive multiple of 24 for exact scenario-cell balance.');
  }
  validateScenarioPool(scenarios, materialVersion);

  const scenariosBySupport = Object.fromEntries(
    SUPPORT_LEVELS.map((support) => [
      support,
      scenarios.filter((scenario) => scenario.supportLevel === support).sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  ) as Record<(typeof SUPPORT_LEVELS)[number], Study2ScenarioRef[]>;
  const conditions = factorialConditions();
  const trials: Study2TrialAssignment[] = [];

  for (let participantIndex = 0; participantIndex < participants; participantIndex += 1) {
    const assigned = conditions.map((condition, conditionIndex) => {
      const supportLevel = SUPPORT_LEVELS[(participantIndex + conditionIndex) % 2];
      const withinPairIndex = Math.floor(conditionIndex / 2);
      const scenarioIndex = (Math.floor(participantIndex / 2) + withinPairIndex) % SCENARIOS_PER_SUPPORT_LEVEL;
      const scenario = scenariosBySupport[supportLevel][scenarioIndex];
      return {
        ...condition,
        participantIndex,
        trialIndex: -1,
        scenarioId: scenario.id,
        supportLevel,
        matchStatus: matchStatus(condition.failureFamily, condition.interventionType),
        allocationSeed: seed,
      } satisfies Study2TrialAssignment;
    });

    const randomized = constrainedTrialShuffle(
      assigned,
      `${seed}:participant:${participantIndex}`,
    );
    randomized.forEach((trial, trialIndex) => trials.push({ ...trial, trialIndex }));
  }

  return {
    schemaVersion: 'study2-allocation-v1',
    materialVersion,
    seed,
    participants,
    trials,
  };
}

function cellKey(trial: Study2TrialAssignment): string {
  return [
    trial.failureFamily,
    trial.interventionType,
    trial.accuracy,
    trial.confidence,
    trial.supportLevel,
  ].join('|');
}

function matrixRank(matrix: number[][], tolerance = 1e-10): number {
  const work = matrix.map((row) => [...row]);
  let rank = 0;
  let column = 0;
  while (rank < work.length && column < work[0].length) {
    let pivot = rank;
    for (let row = rank + 1; row < work.length; row += 1) {
      if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    }
    if (Math.abs(work[pivot][column]) <= tolerance) {
      column += 1;
      continue;
    }
    [work[rank], work[pivot]] = [work[pivot], work[rank]];
    const divisor = work[rank][column];
    for (let j = column; j < work[rank].length; j += 1) work[rank][j] /= divisor;
    for (let row = 0; row < work.length; row += 1) {
      if (row === rank) continue;
      const factor = work[row][column];
      for (let j = column; j < work[row].length; j += 1) work[row][j] -= factor * work[rank][j];
    }
    rank += 1;
    column += 1;
  }
  return rank;
}

export function auditAllocation(allocation: Study2Allocation): AllocationAudit {
  const errors: string[] = [];
  const fullCellCounts: Record<string, number> = {};
  const scenarioExposureCounts: Record<string, number> = {};
  const participants = new Map<number, Study2TrialAssignment[]>();

  if (allocation.schemaVersion !== 'study2-allocation-v1') errors.push('Unsupported allocation schema version.');
  if (!allocation.materialVersion.trim() || !allocation.seed.trim()) errors.push('Allocation requires material version and seed.');
  if (allocation.trials.length !== allocation.participants * TRIALS_PER_PARTICIPANT) errors.push('Allocation trial count does not match participant metadata.');

  for (const trial of allocation.trials) {
    if (trial.allocationSeed !== allocation.seed) errors.push(`Trial ${trial.participantIndex}:${trial.trialIndex} has the wrong allocation seed.`);
    if (trial.matchStatus !== matchStatus(trial.failureFamily, trial.interventionType)) errors.push(`Trial ${trial.participantIndex}:${trial.trialIndex} has an incorrect match-status label.`);
    fullCellCounts[cellKey(trial)] = (fullCellCounts[cellKey(trial)] ?? 0) + 1;
    scenarioExposureCounts[trial.scenarioId] = (scenarioExposureCounts[trial.scenarioId] ?? 0) + 1;
    const participantTrials = participants.get(trial.participantIndex) ?? [];
    participantTrials.push(trial);
    participants.set(trial.participantIndex, participantTrials);
  }

  if (participants.size !== allocation.participants) errors.push('Participant count does not match allocation metadata.');
  if (
    [...participants.keys()].sort((a, b) => a - b).some((participantIndex, index) => participantIndex !== index)
  ) {
    errors.push('Allocation participant indices must be contiguous from zero.');
  }
  const conditionKeys = new Set(factorialConditions().map((condition) => JSON.stringify(condition)));
  for (const [participantIndex, participantTrials] of participants) {
    if (participantTrials.length !== TRIALS_PER_PARTICIPANT) errors.push(`Participant ${participantIndex} does not have 16 trials.`);
    if (new Set(participantTrials.map((trial) => trial.scenarioId)).size !== TRIALS_PER_PARTICIPANT) errors.push(`Participant ${participantIndex} repeats a scenario.`);
    const orderedTrials = [...participantTrials].sort((first, second) => first.trialIndex - second.trialIndex);
    if (
      orderedTrials.some((trial, trialIndex) => trial.trialIndex !== trialIndex) ||
      new Set(orderedTrials.map((trial) => trial.trialIndex)).size !== TRIALS_PER_PARTICIPANT
    ) {
      errors.push(`Participant ${participantIndex} does not have unique contiguous trial indices 0-15.`);
    }
    const observedConditions = new Set(
      participantTrials.map(({ failureFamily, interventionType, accuracy, confidence }) =>
        JSON.stringify({ failureFamily, interventionType, accuracy, confidence }),
      ),
    );
    if (observedConditions.size !== conditionKeys.size || [...conditionKeys].some((key) => !observedConditions.has(key))) {
      errors.push(`Participant ${participantIndex} does not receive every within-participant condition exactly once.`);
    }
    if (participantTrials.filter((trial) => trial.matchStatus === 'matched').length !== 8) errors.push(`Participant ${participantIndex} is not balanced 8 matched / 8 mismatched.`);
    if (maximumRun(orderedTrials.map((trial) => trial.accuracy)) > MAX_CONSECUTIVE_SAME_LEVEL) {
      errors.push(`Participant ${participantIndex} has more than three consecutive answers at one accuracy level.`);
    }
    if (
      maximumRun(orderedTrials.map((trial) => trial.interventionType)) >
      MAX_CONSECUTIVE_SAME_LEVEL
    ) {
      errors.push(`Participant ${participantIndex} has more than three consecutive cards of one intervention type.`);
    }
    if (
      orderedTrials.slice(0, 8).filter((trial) => trial.matchStatus === 'matched').length !== 4 ||
      orderedTrials.slice(8).filter((trial) => trial.matchStatus === 'matched').length !== 4
    ) {
      errors.push(`Participant ${participantIndex} does not distribute matched trials 4/4 across session halves.`);
    }
    for (const support of SUPPORT_LEVELS) {
      if (participantTrials.filter((trial) => trial.supportLevel === support).length !== 8) errors.push(`Participant ${participantIndex} is not balanced on evidence support.`);
    }
  }

  const expectedCellCount = (allocation.participants * TRIALS_PER_PARTICIPANT) / 32;
  if (Object.keys(fullCellCounts).length !== 32) errors.push(`Expected 32 populated cells; observed ${Object.keys(fullCellCounts).length}.`);
  for (const [key, count] of Object.entries(fullCellCounts)) {
    if (count !== expectedCellCount) errors.push(`Cell ${key} has ${count} trials; expected ${expectedCellCount}.`);
  }
  const expectedScenarioCount = (allocation.participants * TRIALS_PER_PARTICIPANT) / 24;
  if (Object.keys(scenarioExposureCounts).length !== 24) errors.push(`Expected 24 exposed scenarios; observed ${Object.keys(scenarioExposureCounts).length}.`);
  for (const [id, count] of Object.entries(scenarioExposureCounts)) {
    if (count !== expectedScenarioCount) errors.push(`Scenario ${id} has ${count} exposures; expected ${expectedScenarioCount}.`);
  }

  const designRows = Object.keys(fullCellCounts).map((key) => {
    const [failure, intervention, accuracy, confidence, support] = key.split('|');
    const f = Number(failure === FAILURE_FAMILIES[1]);
    const i = Number(intervention === INTERVENTION_TYPES[1]);
    return [1, f, i, Number(accuracy === ACCURACY_LEVELS[1]), Number(confidence === '85'), Number(support === SUPPORT_LEVELS[1]), f * i];
  });
  const designRank = matrixRank(designRows);
  const expectedDesignRank = 7;
  if (designRank !== expectedDesignRank) errors.push(`Design matrix rank is ${designRank}; expected ${expectedDesignRank}.`);

  return {
    valid: errors.length === 0,
    errors,
    participants: participants.size,
    trials: allocation.trials.length,
    fullCellCounts,
    scenarioExposureCounts,
    designRank,
    expectedDesignRank,
  };
}

export function placeholderScenarioPool(materialVersion = 'study2-materials-draft-v0'): Study2ScenarioRef[] {
  return SUPPORT_LEVELS.flatMap((supportLevel) =>
    Array.from({ length: SCENARIOS_PER_SUPPORT_LEVEL }, (_, index) => ({
      id: `${supportLevel === 'strong_consensus' ? 'strong' : 'mixed'}_${String(index + 1).padStart(2, '0')}`,
      supportLevel,
      materialVersion,
    })),
  );
}
