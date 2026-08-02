import type { ReviewPairAudit, ReviewPairItem } from './review-submissions';

export interface AdjudicationTrigger {
  decisionDisagreementOrUnresolved: boolean;
  supportDisagreementOrUnresolved: boolean;
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

function triggersFor(pair: ReviewPairItem): AdjudicationTrigger {
  return {
    decisionDisagreementOrUnresolved: !pair.agreesOnDecision,
    supportDisagreementOrUnresolved: !pair.agreesOnSupportLevel,
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
