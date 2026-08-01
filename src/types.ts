export type JsonSchema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
  minimum?: number;
  maximum?: number;
  format?: string;
  [key: string]: unknown;
};

export type PatternName =
  | 'ConfidenceDisplay'
  | 'RelianceDecision'
  | 'OutcomeFeedback';

export interface MeasurementModel {
  intendedConstruct: string;
  role: 'manipulated' | 'measured' | 'outcome';
}

export interface PatternSpec {
  $schema?: string;
  pattern: PatternName;
  version: string;
  construct: string;
  constructDefinition: string;
  input: JsonSchema;
  output: JsonSchema;
  params: JsonSchema;
  composition: {
    allowedAfter: PatternName[];
    allowedBefore: PatternName[];
  };
  measurementModel: MeasurementModel;
}

export interface PatternInstance {
  id: string;
  pattern: PatternName;
  version: string;
  params: Record<string, unknown>;
}

export interface SequenceComposition {
  kind: 'sequence';
  id: string;
  version: string;
  initialInput: JsonSchema;
  patterns: PatternInstance[];
}

export interface ChoiceComposition {
  kind: 'choice';
  id: string;
  version: string;
  branches: Array<{
    id: string;
    composition: SequenceComposition;
  }>;
}

export type Composition = SequenceComposition | ChoiceComposition;

export interface DerivedSchema extends JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchema>;
  required: string[];
  'x-interactionkit-composition': {
    id: string;
    kind: Composition['kind'];
    version: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  derivedSchema: DerivedSchema;
}

export interface PatternRenderer<Input, Output, Params, UIState> {
  setup(input: Input, params: Params): UIState;
  collect(uiState: UIState): Output;
  validate(output: Output): boolean;
}

export interface BasePatternOutput {
  patternName: PatternName;
  patternVersion: string;
  trialIndex: number;
  scenarioId: string;
}

export type PatternOutput = BasePatternOutput;
