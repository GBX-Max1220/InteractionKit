import confidenceDisplay from '../schemas/confidence-display.json';
import outcomeFeedback from '../schemas/outcome-feedback.json';
import relianceDecision from '../schemas/reliance-decision.json';
import type { PatternName, PatternSpec } from './types';

export const patternRegistry: Record<PatternName, PatternSpec> = {
  ConfidenceDisplay: confidenceDisplay as PatternSpec,
  RelianceDecision: relianceDecision as PatternSpec,
  OutcomeFeedback: outcomeFeedback as PatternSpec,
};

export function getPatternSpec(pattern: PatternName): PatternSpec {
  return patternRegistry[pattern];
}
