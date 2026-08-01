export const FAILURE_FAMILIES = [
  'unsupported_numerical_precision',
  'omitted_decision_boundary',
] as const;

export const INTERVENTION_TYPES = [
  'numerical_warrant_card',
  'boundary_condition_card',
] as const;

export const ACCURACY_LEVELS = ['correct', 'incorrect'] as const;
export const CONFIDENCE_LEVELS = [65, 85] as const;
export const SUPPORT_LEVELS = ['strong_consensus', 'mixed_or_conditional'] as const;

export type FailureFamily = (typeof FAILURE_FAMILIES)[number];
export type InterventionType = (typeof INTERVENTION_TYPES)[number];
export type AccuracyLevel = (typeof ACCURACY_LEVELS)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];
export type MatchStatus = 'matched' | 'mismatched';

export interface Study2ScenarioRef {
  id: string;
  supportLevel: SupportLevel;
  materialVersion: string;
}

export interface Study2Condition {
  failureFamily: FailureFamily;
  interventionType: InterventionType;
  accuracy: AccuracyLevel;
  confidence: ConfidenceLevel;
}

export interface Study2TrialAssignment extends Study2Condition {
  participantIndex: number;
  trialIndex: number;
  scenarioId: string;
  supportLevel: SupportLevel;
  matchStatus: MatchStatus;
  allocationSeed: string;
}

export interface Study2Allocation {
  schemaVersion: 'study2-allocation-v1';
  materialVersion: string;
  seed: string;
  participants: number;
  trials: Study2TrialAssignment[];
}

export interface AllocationAudit {
  valid: boolean;
  errors: string[];
  participants: number;
  trials: number;
  fullCellCounts: Record<string, number>;
  scenarioExposureCounts: Record<string, number>;
  designRank: number;
  expectedDesignRank: number;
}
