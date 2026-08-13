import type { FinalReviewOutcome } from './adjudication';
import type { FinalFreezeAudit } from './final-freeze';
import type { CandidateScenario } from './materials';

export interface FrozenStudy2Material {
  candidateId: string;
  domain: CandidateScenario['domain'];
  decisionPrompt: string;
  optionA: string;
  optionB: string;
  targetPopulation: string;
  finalBinaryDecision: Exclude<FinalReviewOutcome['finalBinaryDecision'], 'unresolved'>;
  finalSupportLevel: Exclude<FinalReviewOutcome['finalSupportLevel'], 'unresolved'>;
  finalDecisionBoundary: string;
  finalNumericalGranularity: string;
}

export interface FrozenStudy2MaterialsArtifact {
  schemaVersion: 'study2-frozen-materials-v1';
  roundId: string;
  materialVersion: string;
  sourceOutcomeSha256: string;
  sourceSelectionSha256: string;
  items: FrozenStudy2Material[];
}

export function buildFrozenMaterials(options: {
  candidates: CandidateScenario[];
  audit: FinalFreezeAudit;
  roundId: string;
  materialVersion: string;
  sourceOutcomeSha256: string;
  sourceSelectionSha256: string;
}): FrozenStudy2MaterialsArtifact {
  if (!options.audit.valid) throw new Error('Cannot export materials from an invalid final-freeze audit.');
  if (options.audit.selectedOutcomes.length !== 24) {
    throw new Error('A frozen material export requires exactly 24 selected outcomes.');
  }
  if (!/^[a-f0-9]{64}$/.test(options.sourceOutcomeSha256) || !/^[a-f0-9]{64}$/.test(options.sourceSelectionSha256)) {
    throw new Error('Frozen material export requires valid SHA-256 source bindings.');
  }
  const candidateById = new Map(options.candidates.map((candidate) => [candidate.id, candidate]));
  const items = options.audit.selectedOutcomes.map((outcome): FrozenStudy2Material => {
    const candidate = candidateById.get(outcome.candidateId);
    if (!candidate || candidate.status !== 'source_dossier_complete') {
      throw new Error(`Frozen candidate ${outcome.candidateId} is absent or not source-complete.`);
    }
    if (
      outcome.finalBinaryDecision === 'unresolved' ||
      outcome.finalSupportLevel === 'unresolved'
    ) {
      throw new Error(`Frozen candidate ${outcome.candidateId} has unresolved labels.`);
    }
    return {
      candidateId: candidate.id,
      domain: candidate.domain,
      decisionPrompt: candidate.decisionPrompt,
      optionA: candidate.optionA,
      optionB: candidate.optionB,
      targetPopulation: candidate.targetPopulation,
      finalBinaryDecision: outcome.finalBinaryDecision,
      finalSupportLevel: outcome.finalSupportLevel,
      finalDecisionBoundary: outcome.finalDecisionBoundary,
      finalNumericalGranularity: outcome.finalNumericalGranularity,
    };
  });
  items.sort((first, second) => first.candidateId.localeCompare(second.candidateId));
  return {
    schemaVersion: 'study2-frozen-materials-v1',
    roundId: options.roundId,
    materialVersion: options.materialVersion,
    sourceOutcomeSha256: options.sourceOutcomeSha256,
    sourceSelectionSha256: options.sourceSelectionSha256,
    items,
  };
}
