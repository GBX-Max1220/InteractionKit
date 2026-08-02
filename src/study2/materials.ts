import { SUPPORT_LEVELS, SupportLevel } from './types';

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
  materialVersion: 'study2-candidates-v0.3';
  status: MaterialStatus;
  domain: 'exercise_training' | 'recovery' | 'nutrition' | 'injury_risk' | 'environment';
  provisionalSupportLevel: SupportLevel;
  provisionalCorrectOption: 'option_a' | 'option_b' | 'unresolved';
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
    const participantVisibleText = [scenario.decisionPrompt, scenario.optionA, scenario.optionB].join(
      ' ',
    );
    const shortcutCue = participantVisibleText.match(
      /\b(always|every|everyone|sole|solely|mandatory|ignore|inactive indefinitely)\b/i,
    );
    if (shortcutCue) {
      errors.push(`${scenario.id} contains participant-visible shortcut cue "${shortcutCue[0]}".`);
    }
    const optionAWordCount = scenario.optionA.trim().split(/\s+/).length;
    const optionBWordCount = scenario.optionB.trim().split(/\s+/).length;
    if (Math.abs(optionAWordCount - optionBWordCount) > 8) {
      warnings.push(
        `${scenario.id} has an option-length difference greater than eight words (${optionAWordCount} vs ${optionBWordCount}).`,
      );
    }
    if (scenario.evidenceSources.length < 2) {
      warnings.push(`${scenario.id} has fewer than two evidence sources.`);
    }
    if (scenario.domainReviews.filter((review) => review.independent).length < 2) {
      warnings.push(`${scenario.id} has fewer than two independent domain reviews.`);
    }

    if (scenario.status === 'retained_v1') {
      const independent = scenario.domainReviews.filter((review) => review.independent);
      const independentReviewerIds = new Set(independent.map((review) => review.reviewerId));
      const decisions = new Set(independent.map((review) => review.binaryDecision));
      const supports = new Set(independent.map((review) => review.supportLevel));
      const sourcesComplete = scenario.evidenceSources.every(
        (source) =>
          source.verifiedBy &&
          source.verifiedAt &&
          source.supportsBinaryDecision &&
          source.supportsEvidenceLevel,
      );
      const sourceIds = new Set(scenario.evidenceSources.map((source) => source.id));
      const sourceLocations = new Set(
        scenario.evidenceSources.map((source) => source.urlOrDoi.trim().toLowerCase()),
      );
      const reviewsMatchRegistry = independent.every(
        (review) =>
          review.binaryDecision === scenario.provisionalCorrectOption &&
          review.supportLevel === scenario.provisionalSupportLevel,
      );
      if (
        scenario.evidenceSources.length < 2 ||
        sourceIds.size < 2 ||
        sourceLocations.size < 2 ||
        !sourcesComplete ||
        independent.length < 2 ||
        independentReviewerIds.size < 2 ||
        decisions.size !== 1 ||
        supports.size !== 1 ||
        decisions.has('unresolved') ||
        supports.has('unresolved') ||
        !reviewsMatchRegistry
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
  const retainedDecisionCounts = Object.fromEntries(
    SUPPORT_LEVELS.map((supportLevel) => {
      const supportScenarios = retained.filter(
        (scenario) => scenario.provisionalSupportLevel === supportLevel,
      );
      const optionACount = supportScenarios.filter((scenario) => {
        const independent = scenario.domainReviews.filter((review) => review.independent);
        return independent.length >= 2 && independent.every((review) => review.binaryDecision === 'option_a');
      }).length;
      const optionBCount = supportScenarios.filter((scenario) => {
        const independent = scenario.domainReviews.filter((review) => review.independent);
        return independent.length >= 2 && independent.every((review) => review.binaryDecision === 'option_b');
      }).length;
      return [supportLevel, { option_a: optionACount, option_b: optionBCount }];
    }),
  ) as Record<SupportLevel, { option_a: number; option_b: number }>;
  const retainedDecisionSidesBalanced = SUPPORT_LEVELS.every(
    (supportLevel) =>
      retainedDecisionCounts[supportLevel].option_a === 6 &&
      retainedDecisionCounts[supportLevel].option_b === 6,
  );
  const pilotReady =
    errors.length === 0 &&
    retained.length === 24 &&
    retainedStrong === 12 &&
    retainedMixed === 12 &&
    retainedDecisionSidesBalanced;

  if (!pilotReady) {
    warnings.push(
      'Pool is not pilot-ready: exactly 24 adjudicated scenarios (12 per support level) with 6 option-A and 6 option-B ground truths inside each support level are required.',
    );
  }

  return { structurallyValid: errors.length === 0, pilotReady, errors, warnings, counts };
}
