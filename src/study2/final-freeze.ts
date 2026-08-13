import type { FinalReviewOutcome } from './adjudication';
import type { CandidateScenario } from './materials';
import { SUPPORT_LEVELS, type SupportLevel } from './types';

export interface FreezeExclusion {
  candidateId: string;
  reason: string;
}

export interface FinalFreezeSelection {
  schemaVersion: 'study2-final-freeze-selection-v1';
  roundId: string;
  materialVersion: string;
  selectedCandidateIds: string[];
  selectionRule: string;
  exclusions: FreezeExclusion[];
  selectedBy: string;
  selectedAt: string;
}

export interface FinalFreezeAudit {
  valid: boolean;
  errors: string[];
  selectedOutcomes: FinalReviewOutcome[];
  counts: {
    selected: number;
    support: Record<SupportLevel, number>;
    decisionBySupport: Record<SupportLevel, { option_a: number; option_b: number }>;
    domain: Record<string, number>;
  };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  return [...new Set(values.filter((value) => (seen.has(value) ? true : !seen.add(value))))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isFinalReviewOutcome(value: unknown): value is FinalReviewOutcome {
  return (
    isRecord(value) &&
    nonEmptyString(value.candidateId) &&
    ['retain', 'revise_and_re_review', 'reject'].includes(String(value.disposition)) &&
    ['option_a', 'option_b', 'unresolved'].includes(String(value.finalBinaryDecision)) &&
    [...SUPPORT_LEVELS, 'unresolved'].includes(String(value.finalSupportLevel) as SupportLevel) &&
    typeof value.finalDecisionBoundary === 'string' &&
    typeof value.finalNumericalGranularity === 'string' &&
    ['full_reviewer_agreement', 'adjudication'].includes(String(value.basis))
  );
}

export function auditFinalFreeze(options: {
  candidates: CandidateScenario[];
  outcomes: unknown;
  selection: unknown;
  expectedRoundId: string;
}): FinalFreezeAudit {
  const errors: string[] = [];
  const rawOutcomes = Array.isArray(options.outcomes) ? options.outcomes : [];
  if (!Array.isArray(options.outcomes)) errors.push('Final review outcomes must be an array.');
  const outcomes = rawOutcomes.filter(isFinalReviewOutcome);
  if (outcomes.length !== rawOutcomes.length) {
    errors.push('Every final review outcome must satisfy the outcome schema.');
  }
  const rawSelection = isRecord(options.selection) ? options.selection : {};
  if (!isRecord(options.selection)) errors.push('Final-freeze selection must be a JSON object.');
  const selectedCandidateIds = Array.isArray(rawSelection.selectedCandidateIds)
    ? rawSelection.selectedCandidateIds.filter(nonEmptyString)
    : [];
  if (
    !Array.isArray(rawSelection.selectedCandidateIds) ||
    selectedCandidateIds.length !== rawSelection.selectedCandidateIds.length
  ) {
    errors.push('Selected candidate IDs must be an array of non-empty strings.');
  }
  const rawExclusions = Array.isArray(rawSelection.exclusions) ? rawSelection.exclusions : [];
  const exclusions = rawExclusions.flatMap((value): FreezeExclusion[] =>
    isRecord(value) && nonEmptyString(value.candidateId) && nonEmptyString(value.reason)
      ? [{ candidateId: value.candidateId, reason: value.reason }]
      : [],
  );
  if (!Array.isArray(rawSelection.exclusions) || exclusions.length !== rawExclusions.length) {
    errors.push('Exclusions must contain non-empty candidate IDs and reasons.');
  }
  const sourceComplete = options.candidates.filter(
    (candidate) => candidate.status === 'source_dossier_complete',
  );
  const candidateById = new Map(sourceComplete.map((candidate) => [candidate.id, candidate]));
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.candidateId, outcome]));
  const duplicateOutcomeIds = duplicates(outcomes.map((outcome) => outcome.candidateId));
  if (sourceComplete.length !== 27) errors.push(`Expected 27 source-complete candidates; found ${sourceComplete.length}.`);
  if (duplicateOutcomeIds.length > 0) errors.push(`Duplicate final outcomes: ${duplicateOutcomeIds.join(', ')}.`);
  if (
    outcomeById.size !== candidateById.size ||
    [...candidateById.keys()].some((candidateId) => !outcomeById.has(candidateId)) ||
    [...outcomeById.keys()].some((candidateId) => !candidateById.has(candidateId))
  ) {
    errors.push('Final outcomes must exactly cover the 27 source-complete candidates.');
  }
  if (rawSelection.schemaVersion !== 'study2-final-freeze-selection-v1') {
    errors.push('Unsupported final-freeze selection schema.');
  }
  if (rawSelection.roundId !== options.expectedRoundId) {
    errors.push('Final-freeze selection round ID is incorrect.');
  }
  if (rawSelection.materialVersion !== 'study2-candidates-v0.6') {
    errors.push('Final-freeze selection material version is incorrect.');
  }
  if (!nonEmptyString(rawSelection.selectionRule)) errors.push('A predeclared selection rule is required.');
  if (!nonEmptyString(rawSelection.selectedBy)) errors.push('Final-freeze selector identity is required.');
  if (!nonEmptyString(rawSelection.selectedAt) || !Number.isFinite(Date.parse(rawSelection.selectedAt))) {
    errors.push('Final-freeze timestamp must be valid ISO-8601.');
  }
  const selectedIds = selectedCandidateIds;
  const duplicateSelectedIds = duplicates(selectedIds);
  if (selectedIds.length !== 24) errors.push(`Expected 24 selected candidates; received ${selectedIds.length}.`);
  if (duplicateSelectedIds.length > 0) errors.push(`Duplicate selected candidates: ${duplicateSelectedIds.join(', ')}.`);
  const selectedOutcomes = selectedIds.flatMap((candidateId) => {
    const outcome = outcomeById.get(candidateId);
    if (!outcome) {
      errors.push(`Selected candidate ${candidateId} has no final review outcome.`);
      return [];
    }
    if (outcome.disposition !== 'retain') {
      errors.push(`Selected candidate ${candidateId} is not eligible for retention.`);
    }
    if (
      !['option_a', 'option_b'].includes(outcome.finalBinaryDecision) ||
      !SUPPORT_LEVELS.includes(outcome.finalSupportLevel as SupportLevel)
    ) {
      errors.push(`Selected candidate ${candidateId} has unresolved final labels.`);
    }
    if (!outcome.finalDecisionBoundary.trim() || !outcome.finalNumericalGranularity.trim()) {
      errors.push(`Selected candidate ${candidateId} lacks final calibration boundaries.`);
    }
    return [outcome];
  });

  const eligibleUnselected = outcomes.filter(
    (outcome) => outcome.disposition === 'retain' && !selectedIds.includes(outcome.candidateId),
  );
  const exclusionById = new Map(
    exclusions.map((exclusion) => [exclusion.candidateId, exclusion]),
  );
  if (exclusionById.size !== exclusions.length) {
    errors.push('Final-freeze exclusions contain duplicate candidate IDs.');
  }
  for (const outcome of eligibleUnselected) {
    const exclusion = exclusionById.get(outcome.candidateId);
    if (!exclusion || !exclusion.reason.trim()) {
      errors.push(`Eligible unselected candidate ${outcome.candidateId} requires an exclusion reason.`);
    }
  }
  for (const exclusion of exclusions) {
    if (!eligibleUnselected.some((outcome) => outcome.candidateId === exclusion.candidateId)) {
      errors.push(`Exclusion ${exclusion.candidateId} does not describe an eligible unselected candidate.`);
    }
  }

  const support = Object.fromEntries(SUPPORT_LEVELS.map((level) => [level, 0])) as Record<SupportLevel, number>;
  const decisionBySupport = Object.fromEntries(
    SUPPORT_LEVELS.map((level) => [level, { option_a: 0, option_b: 0 }]),
  ) as Record<SupportLevel, { option_a: number; option_b: number }>;
  const domain: Record<string, number> = {};
  for (const outcome of selectedOutcomes) {
    if (SUPPORT_LEVELS.includes(outcome.finalSupportLevel as SupportLevel)) {
      const level = outcome.finalSupportLevel as SupportLevel;
      support[level] += 1;
      if (outcome.finalBinaryDecision === 'option_a' || outcome.finalBinaryDecision === 'option_b') {
        decisionBySupport[level][outcome.finalBinaryDecision] += 1;
      }
    }
    const candidateDomain = candidateById.get(outcome.candidateId)?.domain;
    if (candidateDomain) domain[candidateDomain] = (domain[candidateDomain] ?? 0) + 1;
  }
  for (const level of SUPPORT_LEVELS) {
    if (support[level] !== 12) errors.push(`Final freeze requires 12 ${level} scenarios; found ${support[level]}.`);
    if (
      decisionBySupport[level].option_a !== 6 ||
      decisionBySupport[level].option_b !== 6
    ) {
      errors.push(`Final freeze requires 6 option-A and 6 option-B decisions within ${level}.`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    selectedOutcomes,
    counts: { selected: selectedOutcomes.length, support, decisionBySupport, domain },
  };
}
