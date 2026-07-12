// InteractionKit Log Event — TypeScript types
// Synced from schemas/log-event.schema.json v0.3.0

export type ConditionId = 'v1' | 'v2';
export type Decision = 'trust' | 'distrust' | 'unsure';
export type EventType = 'decision' | 'demographics' | 'tsi_response' | 'session_start' | 'session_complete';
export type StudyId = 'interactionkit' | 'independent-implementation';

export interface LogEvent {
  participantId: string;
  studyId: StudyId;
  condition: ConditionId;
  patternVersion: 1 | 2;
  scenarioId: string;
  eventType: EventType;
  timestamp: string;
  decision: Decision;
  decisionTimeMs: number;
  probabilityPrediction: number;

  // Optional: per-scenario familiarity covariate
  familiarity?: number;

  // Optional: demographics
  age?: string;
  gender?: string;
  aiFamiliarity?: number;

  // Optional measurement module: TSI
  tsi_01?: number;
  tsi_02?: number;
  tsi_03?: number;
  tsi_04?: number;
  tsi_05?: number;
  tsi_06?: number;
  tsi_07?: number;
  tsi_08?: number;
  tsi_09?: number;
  tsi_10?: number;
  tsi_11?: number;
  tsi_12?: number;
  tsiMean?: number;
}

export interface StudyConfig {
  studyId: string;
  title: string;
  description: string;
  conditions: { id: ConditionId; label: string; patternVersion: 1 | 2 }[];
  scenarioGroup: string;
  randomize: boolean;
  scenariosPerParticipant: number;
  minScenariosForCompletion: number;
}

export interface Scenario {
  id: string;
  question: string;
  aiAnswer: string;
  answerAccurate: boolean;
  groundTruth: string;
  aiConfidence: number;
  evidenceSources?: { title: string; quality: number }[];
  calibrationExplanation?: string;
}

export interface SessionCheckpoint {
  participantId: string;
  condition: ConditionId;
  studyId: StudyId;
  completedScenariosCount: number;
  currentScenarioIndex: number;
  scenarioOrderIds: string[];
  createdAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  eventCount: number;
}
