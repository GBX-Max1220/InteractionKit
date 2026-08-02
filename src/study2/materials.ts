import { SupportLevel } from './types';

export type MaterialStatus =
  | 'candidate_unreviewed'
  | 'source_dossier_complete'
  | 'review_round_1'
  | 'adjudication_required'
  | 'retained_v1'
  | 'rejected';

export interface EvidenceSourceRecord {
  id: string;
  citation: string;
  urlOrDoi: string;
  authorityType: 'guideline' | 'position_stand' | 'systematic_review' | 'meta_analysis';
  supportsBinaryDecision: boolean;
  supportsEvidenceLevel: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface DomainReviewRecord {
  reviewerId: string;
  independent: boolean;
  binaryDecision: 'option_a' | 'option_b' | 'unresolved';
  supportLevel: SupportLevel | 'unresolved';
  decisionBoundary: string;
  numericalGranularity: string;
  reviewedAt: string;
}

export interface CandidateScenario {
  id: string;
  materialVersion: 'study2-candidates-v0';
  status: MaterialStatus;
  domain: 'exercise_training' | 'recovery' | 'nutrition' | 'injury_risk' | 'environment';
  provisionalSupportLevel: SupportLevel;
  decisionPrompt: string;
  optionA: string;
  optionB: string;
  targetPopulation: string;
  intendedDecisionBoundary: string;
  intendedNumericalGranularity: string;
  evidenceSources: EvidenceSourceRecord[];
  domainReviews: DomainReviewRecord[];
  authoringNotes: string;
}

export interface CandidatePoolAudit {
  structurallyValid: boolean;
  pilotReady: boolean;
  errors: string[];
  warnings: string[];
  counts: Record<string, number>;
}

export function auditCandidatePool(candidates: CandidateScenario[]): CandidatePoolAudit {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(candidates.map((item) => item.id));

  if (candidates.length !== 32) errors.push(`Expected 32 candidate scenarios; received ${candidates.length}.`);
  if (ids.size !== candidates.length) errors.push('Candidate scenario IDs are not unique.');

  const counts: Record<string, number> = {};
  for (const scenario of candidates) {
    counts[scenario.provisionalSupportLevel] =
      (counts[scenario.provisionalSupportLevel] ?? 0) + 1;
    if (!scenario.decisionPrompt.trim() || !scenario.optionA.trim() || !scenario.optionB.trim()) {
      errors.push(`${scenario.id} is missing a binary decision field.`);
    }
    if (!scenario.intendedDecisionBoundary.trim()) {
      errors.push(`${scenario.id} is missing an intended decision boundary.`);
    }
    if (!scenario.intendedNumericalGranularity.trim()) {
      errors.push(`${scenario.id} is missing intended numerical granularity.`);
    }
    if (scenario.evidenceSources.length < 2) {
      warnings.push(`${scenario.id} has fewer than two evidence sources.`);
    }
    if (scenario.domainReviews.filter((review) => review.independent).length < 2) {
      warnings.push(`${scenario.id} has fewer than two independent domain reviews.`);
    }

    if (scenario.status === 'retained_v1') {
      const independent = scenario.domainReviews.filter((review) => review.independent);
      const decisions = new Set(independent.map((review) => review.binaryDecision));
      const supports = new Set(independent.map((review) => review.supportLevel));
      const sourcesVerified = scenario.evidenceSources.every(
        (source) => source.verifiedBy && source.verifiedAt,
      );
      if (
        scenario.evidenceSources.length < 2 ||
        !sourcesVerified ||
        independent.length < 2 ||
        decisions.size !== 1 ||
        supports.size !== 1 ||
        decisions.has('unresolved') ||
        supports.has('unresolved')
      ) {
        errors.push(
          `${scenario.id} is marked retained_v1 without complete, agreeing evidence and reviews.`,
        );
      }
    }
  }

  if (counts.strong_consensus !== 16) {
    errors.push(
      `Expected 16 strong-consensus candidates; received ${counts.strong_consensus ?? 0}.`,
    );
  }
  if (counts.mixed_or_conditional !== 16) {
    errors.push(
      `Expected 16 mixed/conditional candidates; received ${counts.mixed_or_conditional ?? 0}.`,
    );
  }

  const retained = candidates.filter((item) => item.status === 'retained_v1');
  const retainedStrong = retained.filter(
    (item) => item.provisionalSupportLevel === 'strong_consensus',
  ).length;
  const retainedMixed = retained.filter(
    (item) => item.provisionalSupportLevel === 'mixed_or_conditional',
  ).length;
  const pilotReady =
    errors.length === 0 &&
    retained.length === 24 &&
    retainedStrong === 12 &&
    retainedMixed === 12;

  if (!pilotReady) {
    warnings.push(
      'Pool is not pilot-ready: exactly 24 adjudicated scenarios (12 per support level) are required.',
    );
  }

  return { structurallyValid: errors.length === 0, pilotReady, errors, warnings, counts };
}
