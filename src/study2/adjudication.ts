import type { ReviewPairAudit, ReviewPairItem } from './review-submissions';
import type { SupportLevel } from './types';

export interface AdjudicationTrigger {
  decisionDisagreementOrUnresolved: boolean;
  supportDisagreementOrUnresolved: boolean;
  decisionBoundaryDisagreement: boolean;
  numericalGranularityDisagreement: boolean;
  recommendationNotRetain: boolean;
  sourceConcernIdentified: boolean;
}

export interface AdjudicationQueueItem {
  candidateId: string;
  status: 'pending';
  triggers: AdjudicationTrigger;
  firstReview: ReviewPairItem['first'];
  secondReview: ReviewPairItem['second'];
}

export interface AdjudicationQueue {
  schemaVersion: 'study2-adjudication-queue-v1';
  roundId: string;
  materialVersion: string;
  panelId: string;
  generatedAt: string;
  items: AdjudicationQueueItem[];
}

export type AdjudicationMethod = 'third_expert' | 'reviewer_consensus_after_lock';
export type AdjudicationDisposition =
  | 'retain_without_change'
  | 'revise_and_re_review'
  | 'reject';

export interface AdjudicationResolutionItem {
  candidateId: string;
  disposition: AdjudicationDisposition;
  finalBinaryDecision: 'option_a' | 'option_b' | 'unresolved';
  finalSupportLevel: SupportLevel | 'unresolved';
  finalDecisionBoundary: string;
  finalNumericalGranularity: string;
  rationale: string;
}

export interface AdjudicationResolution {
  schemaVersion: 'study2-adjudication-resolution-v1';
  roundId: string;
  materialVersion: string;
  panelId: string;
  method: AdjudicationMethod;
  resolverIds: string[];
  relevantQualifications: string;
  conflictOfInterestStatement: string;
  independenceAttestation: string;
  materialContributionConflict: boolean;
  adjudicatedAt: string;
  items: AdjudicationResolutionItem[];
}

export interface AdjudicationResolutionValidation {
  valid: boolean;
  errors: string[];
}

export interface FinalReviewOutcome {
  candidateId: string;
  disposition: 'retain' | 'revise_and_re_review' | 'reject';
  finalBinaryDecision: 'option_a' | 'option_b' | 'unresolved';
  finalSupportLevel: SupportLevel | 'unresolved';
  finalDecisionBoundary: string;
  finalNumericalGranularity: string;
  basis: 'full_reviewer_agreement' | 'adjudication';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function triggersFor(pair: ReviewPairItem): AdjudicationTrigger {
  return {
    decisionDisagreementOrUnresolved: !pair.agreesOnDecision,
    supportDisagreementOrUnresolved: !pair.agreesOnSupportLevel,
    decisionBoundaryDisagreement: !pair.agreesOnDecisionBoundary,
    numericalGranularityDisagreement: !pair.agreesOnNumericalGranularity,
    recommendationNotRetain: !pair.bothRecommendRetain,
    sourceConcernIdentified:
      pair.first.sourceConcernIdentified || pair.second.sourceConcernIdentified,
  };
}

export function buildAdjudicationQueue(options: {
  audit: ReviewPairAudit;
  roundId: string;
  materialVersion: string;
  panelId: string;
  generatedAt: string;
}): AdjudicationQueue {
  if (!options.audit.valid) {
    throw new Error('Cannot build an adjudication queue from an invalid review-pair audit.');
  }
  const items = options.audit.items
    .filter((pair) => pair.adjudicationRequired)
    .map((pair) => {
      const triggers = triggersFor(pair);
      if (!Object.values(triggers).some(Boolean)) {
        throw new Error(`${pair.candidateId} requires adjudication without a recorded trigger.`);
      }
      return {
        candidateId: pair.candidateId,
        status: 'pending' as const,
        triggers,
        firstReview: pair.first,
        secondReview: pair.second,
      };
    });
  items.sort((first, second) => first.candidateId.localeCompare(second.candidateId));
  return {
    schemaVersion: 'study2-adjudication-queue-v1',
    roundId: options.roundId,
    materialVersion: options.materialVersion,
    panelId: options.panelId,
    generatedAt: options.generatedAt,
    items,
  };
}

export function validateAdjudicationResolution(
  value: unknown,
  queue: AdjudicationQueue,
): AdjudicationResolutionValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ['Adjudication resolution must be a JSON object.'] };
  }
  if (value.schemaVersion !== 'study2-adjudication-resolution-v1') {
    errors.push('Unsupported adjudication-resolution schema version.');
  }
  if (value.roundId !== queue.roundId || value.materialVersion !== queue.materialVersion) {
    errors.push('Adjudication resolution does not match the queue round or materials.');
  }
  if (value.panelId !== queue.panelId) {
    errors.push('Adjudication resolution does not match the expertise panel.');
  }
  if (!['third_expert', 'reviewer_consensus_after_lock'].includes(String(value.method))) {
    errors.push('Adjudication method is invalid.');
  }
  const resolverIds = Array.isArray(value.resolverIds)
    ? value.resolverIds.filter(nonEmptyString).map((resolverId) => resolverId.trim())
    : [];
  if (resolverIds.length === 0 || resolverIds.length !== new Set(resolverIds).size) {
    errors.push('Adjudication requires unique non-empty resolver IDs.');
  }
  for (const field of [
    'relevantQualifications',
    'conflictOfInterestStatement',
    'independenceAttestation',
  ] as const) {
    if (!nonEmptyString(value[field])) errors.push(`Adjudication is missing ${field}.`);
  }
  if (value.materialContributionConflict !== false) {
    errors.push('An adjudicator who contributed to the materials is ineligible.');
  }
  if (!nonEmptyString(value.adjudicatedAt) || !Number.isFinite(Date.parse(value.adjudicatedAt))) {
    errors.push('Adjudication timestamp must be valid ISO-8601.');
  }

  const originalReviewerIds = new Set(
    queue.items.flatMap((item) => [item.firstReview.reviewerId, item.secondReview.reviewerId]),
  );
  if (value.method === 'third_expert' && resolverIds.some((id) => originalReviewerIds.has(id))) {
    errors.push('A third-expert adjudicator must be distinct from both original reviewers.');
  }
  if (
    value.method === 'reviewer_consensus_after_lock' &&
    (resolverIds.length !== originalReviewerIds.size ||
      resolverIds.some((id) => !originalReviewerIds.has(id)))
  ) {
    errors.push('Consensus adjudication must name exactly the two original reviewers.');
  }

  const rawItems = Array.isArray(value.items) ? value.items : [];
  if (!Array.isArray(value.items)) errors.push('Adjudication items must be an array.');
  const expectedByCandidateId = new Map(queue.items.map((item) => [item.candidateId, item]));
  const seenCandidateIds = new Set<string>();
  if (rawItems.length !== queue.items.length) {
    errors.push(`Expected ${queue.items.length} adjudication items; received ${rawItems.length}.`);
  }
  for (const [index, rawItem] of rawItems.entries()) {
    if (!isRecord(rawItem)) {
      errors.push(`Adjudication item ${index + 1} must be a JSON object.`);
      continue;
    }
    const candidateId = nonEmptyString(rawItem.candidateId) ? rawItem.candidateId : '';
    const label = candidateId || `Adjudication item ${index + 1}`;
    if (seenCandidateIds.has(candidateId)) errors.push(`Duplicate adjudication item ${candidateId}.`);
    seenCandidateIds.add(candidateId);
    const queued = expectedByCandidateId.get(candidateId);
    if (!queued) {
      errors.push(`${label} is not in the adjudication queue.`);
      continue;
    }
    if (!['retain_without_change', 'revise_and_re_review', 'reject'].includes(String(rawItem.disposition))) {
      errors.push(`${label} has an invalid adjudication disposition.`);
    }
    if (!nonEmptyString(rawItem.rationale)) errors.push(`${label} is missing a rationale.`);
    if (rawItem.disposition === 'retain_without_change') {
      if (queued.triggers.sourceConcernIdentified) {
        errors.push(`${label} cannot be retained without change while a source concern exists.`);
      }
      if (!['option_a', 'option_b'].includes(String(rawItem.finalBinaryDecision))) {
        errors.push(`${label} retention requires a resolved binary decision.`);
      }
      if (!['strong_consensus', 'mixed_or_conditional'].includes(String(rawItem.finalSupportLevel))) {
        errors.push(`${label} retention requires a resolved support level.`);
      }
      if (
        !nonEmptyString(rawItem.finalDecisionBoundary) ||
        !nonEmptyString(rawItem.finalNumericalGranularity)
      ) {
        errors.push(`${label} retention requires final boundary and granularity text.`);
      }
    }
  }
  for (const candidateId of expectedByCandidateId.keys()) {
    if (!seenCandidateIds.has(candidateId)) errors.push(`Resolution is missing ${candidateId}.`);
  }
  return { valid: errors.length === 0, errors };
}

export function resolveReviewOutcomes(options: {
  audit: ReviewPairAudit;
  queue: AdjudicationQueue;
  resolution?: AdjudicationResolution;
}): { valid: boolean; errors: string[]; outcomes: FinalReviewOutcome[] } {
  if (!options.audit.valid) {
    return { valid: false, errors: ['Review-pair audit is invalid.'], outcomes: [] };
  }
  if (options.queue.items.length > 0 && !options.resolution) {
    return { valid: false, errors: ['Adjudication resolution is required.'], outcomes: [] };
  }
  if (options.queue.items.length === 0 && options.resolution) {
    return { valid: false, errors: ['No adjudication resolution is allowed for an empty queue.'], outcomes: [] };
  }
  if (options.resolution) {
    const validation = validateAdjudicationResolution(options.resolution, options.queue);
    if (!validation.valid) return { valid: false, errors: validation.errors, outcomes: [] };
  }
  const resolutionByCandidateId = new Map(
    options.resolution?.items.map((item) => [item.candidateId, item]) ?? [],
  );
  const outcomes = options.audit.items.map((pair): FinalReviewOutcome => {
    if (!pair.adjudicationRequired) {
      return {
        candidateId: pair.candidateId,
        disposition: 'retain',
        finalBinaryDecision: pair.first.binaryDecision,
        finalSupportLevel: pair.first.supportLevel,
        finalDecisionBoundary: pair.first.decisionBoundary,
        finalNumericalGranularity: pair.first.numericalGranularity,
        basis: 'full_reviewer_agreement',
      };
    }
    const resolved = resolutionByCandidateId.get(pair.candidateId)!;
    return {
      candidateId: pair.candidateId,
      disposition:
        resolved.disposition === 'retain_without_change' ? 'retain' : resolved.disposition,
      finalBinaryDecision: resolved.finalBinaryDecision,
      finalSupportLevel: resolved.finalSupportLevel,
      finalDecisionBoundary: resolved.finalDecisionBoundary,
      finalNumericalGranularity: resolved.finalNumericalGranularity,
      basis: 'adjudication',
    };
  });
  outcomes.sort((first, second) => first.candidateId.localeCompare(second.candidateId));
  return { valid: true, errors: [], outcomes };
}
