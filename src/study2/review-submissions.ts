import type { CandidateScenario, DomainReviewRecord } from './materials';
import type {
  ReviewerCrosswalkItem,
  ReviewerPacket,
} from './review-packets';
import type { SupportLevel } from './types';

export type ReviewRecommendation = 'retain' | 'revise' | 'reject';
export type ReviewBinaryDecision = DomainReviewRecord['binaryDecision'];
export type ReviewSupportLevel = SupportLevel | 'unresolved';

export interface ReviewSubmissionItem {
  blindId: string;
  binaryDecision: ReviewBinaryDecision;
  supportLevel: ReviewSupportLevel;
  decisionBoundary: string;
  numericalGranularity: string;
  sourceConcern: string;
  recommendation: ReviewRecommendation;
  rationale: string;
}

export interface ReviewSubmission {
  schemaVersion: 'study2-domain-review-submission-v2';
  materialVersion: CandidateScenario['materialVersion'];
  reviewerId: string;
  packetSeed: string;
  relevantExpertise: string;
  conflictOfInterestStatement: string;
  submittedAt: string;
  items: ReviewSubmissionItem[];
}

export interface SubmissionValidation {
  valid: boolean;
  errors: string[];
}

const allowedSubmissionKeys = new Set([
  'schemaVersion',
  'materialVersion',
  'reviewerId',
  'packetSeed',
  'relevantExpertise',
  'conflictOfInterestStatement',
  'submittedAt',
  'items',
]);

const allowedItemKeys = new Set([
  'blindId',
  'binaryDecision',
  'supportLevel',
  'decisionBoundary',
  'numericalGranularity',
  'sourceConcern',
  'recommendation',
  'rationale',
]);

function unknownKeys(value: object, allowed: Set<string>): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateReviewSubmission(
  submission: unknown,
  packet: ReviewerPacket,
): SubmissionValidation {
  const errors: string[] = [];
  if (!isRecord(submission)) {
    return { valid: false, errors: ['Submission must be a JSON object.'] };
  }
  const extraTopLevelKeys = unknownKeys(submission, allowedSubmissionKeys);
  if (extraTopLevelKeys.length > 0) {
    errors.push(`Submission contains unexpected fields: ${extraTopLevelKeys.join(', ')}.`);
  }
  if (submission.schemaVersion !== 'study2-domain-review-submission-v2') {
    errors.push('Unsupported review-submission schema version.');
  }
  if (submission.materialVersion !== packet.materialVersion) {
    errors.push('Submission material version does not match the reviewer packet.');
  }
  if (submission.reviewerId !== packet.reviewerId) {
    errors.push('Submission reviewer ID does not match the reviewer packet.');
  }
  if (submission.packetSeed !== packet.packetSeed) {
    errors.push('Submission packet seed does not match the reviewer packet.');
  }
  if (
    typeof submission.relevantExpertise !== 'string' ||
    !submission.relevantExpertise.trim()
  ) {
    errors.push('Relevant expertise is required.');
  }
  if (
    typeof submission.conflictOfInterestStatement !== 'string' ||
    !submission.conflictOfInterestStatement.trim()
  ) {
    errors.push('Conflict-of-interest statement is required.');
  }
  if (
    typeof submission.submittedAt !== 'string' ||
    !Number.isFinite(Date.parse(submission.submittedAt))
  ) {
    errors.push('Submission timestamp must be a valid ISO-8601 timestamp.');
  }

  const expectedBlindIds = new Set(packet.items.map((item) => item.blindId));
  const submittedItems = Array.isArray(submission.items) ? submission.items : [];
  if (!Array.isArray(submission.items)) {
    errors.push('Submission items must be an array.');
  }
  const submittedBlindIds = new Set(
    submittedItems.flatMap((item) =>
      isRecord(item) && typeof item.blindId === 'string' ? [item.blindId] : [],
    ),
  );
  if (submittedItems.length !== packet.items.length) {
    errors.push(`Expected ${packet.items.length} review items; received ${submittedItems.length}.`);
  }
  if (submittedBlindIds.size !== submittedItems.length) {
    errors.push('Submission contains duplicate blind IDs.');
  }
  for (const blindId of expectedBlindIds) {
    if (!submittedBlindIds.has(blindId)) errors.push(`Submission is missing ${blindId}.`);
  }
  for (const blindId of submittedBlindIds) {
    if (!expectedBlindIds.has(blindId)) errors.push(`Submission contains unknown blind ID ${blindId}.`);
  }

  for (const [index, rawItem] of submittedItems.entries()) {
    if (!isRecord(rawItem)) {
      errors.push(`Review item ${index + 1} must be a JSON object.`);
      continue;
    }
    const item = rawItem;
    const itemLabel = typeof item.blindId === 'string' ? item.blindId : `Item ${index + 1}`;
    const extraItemKeys = unknownKeys(item, allowedItemKeys);
    if (extraItemKeys.length > 0) {
      errors.push(`${itemLabel} contains unexpected fields: ${extraItemKeys.join(', ')}.`);
    }
    if (
      typeof item.binaryDecision !== 'string' ||
      !['option_a', 'option_b', 'unresolved'].includes(item.binaryDecision)
    ) {
      errors.push(`${itemLabel} has an invalid binary decision.`);
    }
    if (
      typeof item.supportLevel !== 'string' ||
      !['strong_consensus', 'mixed_or_conditional', 'unresolved'].includes(item.supportLevel)
    ) {
      errors.push(`${itemLabel} has an invalid support level.`);
    }
    if (
      typeof item.recommendation !== 'string' ||
      !['retain', 'revise', 'reject'].includes(item.recommendation)
    ) {
      errors.push(`${itemLabel} has an invalid recommendation.`);
    }
    if (
      ![
        item.decisionBoundary,
        item.numericalGranularity,
        item.sourceConcern,
        item.rationale,
      ].every((value) => typeof value === 'string' && value.trim())
    ) {
      errors.push(`${itemLabel} is missing required written justification.`);
    }
    if (
      item.recommendation === 'retain' &&
      (item.binaryDecision === 'unresolved' || item.supportLevel === 'unresolved')
    ) {
      errors.push(`${itemLabel} cannot be retained with an unresolved judgment.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface UnblindedReviewItem extends ReviewSubmissionItem {
  candidateId: string;
  reviewerId: string;
  reviewedAt: string;
}

export function unblindReviewSubmission(
  submission: ReviewSubmission,
  packet: ReviewerPacket,
  crosswalk: ReviewerCrosswalkItem[],
): UnblindedReviewItem[] {
  const validation = validateReviewSubmission(submission, packet);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  if (crosswalk.length !== packet.items.length) {
    throw new Error('Crosswalk length does not match the reviewer packet.');
  }
  const candidateIdByBlindId = new Map(
    crosswalk.map((item) => [item.blindId, item.candidateId]),
  );
  if (candidateIdByBlindId.size !== crosswalk.length) {
    throw new Error('Crosswalk contains duplicate blind IDs.');
  }
  return submission.items.map((item) => {
    const candidateId = candidateIdByBlindId.get(item.blindId);
    if (!candidateId) throw new Error(`Crosswalk is missing ${item.blindId}.`);
    return {
      ...item,
      candidateId,
      reviewerId: submission.reviewerId,
      reviewedAt: submission.submittedAt,
    };
  });
}

export interface ReviewPairItem {
  candidateId: string;
  first: UnblindedReviewItem;
  second: UnblindedReviewItem;
  agreesOnDecision: boolean;
  agreesOnSupportLevel: boolean;
  bothRecommendRetain: boolean;
  adjudicationRequired: boolean;
}

export interface ReviewPairAudit {
  valid: boolean;
  errors: string[];
  items: ReviewPairItem[];
  counts: {
    reviewed: number;
    fullAgreement: number;
    adjudicationRequired: number;
  };
}

export function auditIndependentReviewPair(options: {
  firstSubmission: ReviewSubmission;
  firstPacket: ReviewerPacket;
  firstCrosswalk: ReviewerCrosswalkItem[];
  secondSubmission: ReviewSubmission;
  secondPacket: ReviewerPacket;
  secondCrosswalk: ReviewerCrosswalkItem[];
}): ReviewPairAudit {
  const errors: string[] = [];
  if (options.firstSubmission.reviewerId === options.secondSubmission.reviewerId) {
    errors.push('Independent review requires two distinct reviewer IDs.');
  }
  const firstValidation = validateReviewSubmission(
    options.firstSubmission,
    options.firstPacket,
  );
  const secondValidation = validateReviewSubmission(
    options.secondSubmission,
    options.secondPacket,
  );
  errors.push(...firstValidation.errors.map((error) => `First reviewer: ${error}`));
  errors.push(...secondValidation.errors.map((error) => `Second reviewer: ${error}`));
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      items: [],
      counts: { reviewed: 0, fullAgreement: 0, adjudicationRequired: 0 },
    };
  }

  let firstItems: UnblindedReviewItem[];
  let secondItems: UnblindedReviewItem[];
  try {
    firstItems = unblindReviewSubmission(
      options.firstSubmission,
      options.firstPacket,
      options.firstCrosswalk,
    );
    secondItems = unblindReviewSubmission(
      options.secondSubmission,
      options.secondPacket,
      options.secondCrosswalk,
    );
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      items: [],
      counts: { reviewed: 0, fullAgreement: 0, adjudicationRequired: 0 },
    };
  }

  const secondByCandidateId = new Map(
    secondItems.map((item) => [item.candidateId, item]),
  );
  if (secondByCandidateId.size !== secondItems.length) {
    errors.push('Second reviewer crosswalk does not resolve to unique candidates.');
  }
  const items: ReviewPairItem[] = [];
  for (const first of firstItems) {
    const second = secondByCandidateId.get(first.candidateId);
    if (!second) {
      errors.push(`Second reviewer is missing candidate ${first.candidateId}.`);
      continue;
    }
    const agreesOnDecision =
      first.binaryDecision !== 'unresolved' &&
      first.binaryDecision === second.binaryDecision;
    const agreesOnSupportLevel =
      first.supportLevel !== 'unresolved' &&
      first.supportLevel === second.supportLevel;
    const bothRecommendRetain =
      first.recommendation === 'retain' && second.recommendation === 'retain';
    items.push({
      candidateId: first.candidateId,
      first,
      second,
      agreesOnDecision,
      agreesOnSupportLevel,
      bothRecommendRetain,
      adjudicationRequired:
        !agreesOnDecision || !agreesOnSupportLevel || !bothRecommendRetain,
    });
  }
  items.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  const fullAgreement = items.filter((item) => !item.adjudicationRequired).length;
  return {
    valid: errors.length === 0,
    errors,
    items,
    counts: {
      reviewed: items.length,
      fullAgreement,
      adjudicationRequired: items.length - fullAgreement,
    },
  };
}

export function toDomainReviewRecords(
  pair: ReviewPairItem,
): [DomainReviewRecord, DomainReviewRecord] {
  return [pair.first, pair.second].map((review) => ({
    reviewerId: review.reviewerId,
    independent: true,
    binaryDecision: review.binaryDecision,
    supportLevel: review.supportLevel,
    decisionBoundary: review.decisionBoundary,
    numericalGranularity: review.numericalGranularity,
    reviewedAt: review.reviewedAt,
  })) as [DomainReviewRecord, DomainReviewRecord];
}
