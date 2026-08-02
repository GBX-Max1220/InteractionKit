import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdjudicationQueue } from '../src/study2/adjudication';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { generateReviewerPacket } from '../src/study2/review-packets';
import {
  auditIndependentReviewPair,
  type ReviewSubmission,
} from '../src/study2/review-submissions';

const candidates = STUDY2_CANDIDATES.filter(
  (candidate) =>
    candidate.status === 'source_dossier_complete' && candidate.domain === 'nutrition',
);

function submission(
  reviewerId: string,
  packetSeed: string,
  items: Array<{ blindId: string }>,
): ReviewSubmission {
  return {
    schemaVersion: 'study2-domain-review-submission-v3',
    materialVersion: 'study2-candidates-v0.6',
    reviewerId,
    packetSeed,
    relevantExpertise: 'Sports nutrition.',
    conflictOfInterestStatement: 'No relevant conflict.',
    submittedAt: '2026-08-02T12:00:00Z',
    items: items.map((item) => ({
      blindId: item.blindId,
      binaryDecision: 'option_a',
      supportLevel: 'strong_consensus',
      decisionBoundary: 'Reviewer-defined boundary.',
      numericalGranularity: 'Direction only.',
      sourceConcernIdentified: false,
      sourceConcern: 'None identified.',
      recommendation: 'retain',
      rationale: 'The supplied sources support this judgment.',
    })),
  };
}

test('adjudication queue preserves the exact disagreement and source-concern triggers', () => {
  const first = generateReviewerPacket({ candidates, reviewerId: 'nutrition-01', seed: 'round' });
  const second = generateReviewerPacket({ candidates, reviewerId: 'nutrition-02', seed: 'round' });
  const firstSubmission = submission('nutrition-01', 'round', first.packet.items);
  const secondSubmission = submission('nutrition-02', 'round', second.packet.items);
  secondSubmission.items[0] = {
    ...secondSubmission.items[0],
    binaryDecision: 'option_b',
    sourceConcernIdentified: true,
    sourceConcern: 'The source population is not aligned.',
    recommendation: 'revise',
  };
  const audit = auditIndependentReviewPair({
    firstSubmission,
    firstPacket: first.packet,
    firstCrosswalk: first.crosswalk,
    secondSubmission,
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
  });
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  const queue = buildAdjudicationQueue({
    audit,
    roundId: 'study2-domain-review-round-v2',
    materialVersion: 'study2-candidates-v0.6',
    panelId: 'sports-nutrition',
    generatedAt: '2026-08-02T13:00:00Z',
  });
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].triggers.decisionDisagreementOrUnresolved, true);
  assert.equal(queue.items[0].triggers.recommendationNotRetain, true);
  assert.equal(queue.items[0].triggers.sourceConcernIdentified, true);
  assert.equal(queue.items[0].secondReview.sourceConcern, 'The source population is not aligned.');
});

test('full agreement produces an empty adjudication queue', () => {
  const first = generateReviewerPacket({ candidates, reviewerId: 'nutrition-01', seed: 'round' });
  const second = generateReviewerPacket({ candidates, reviewerId: 'nutrition-02', seed: 'round' });
  const audit = auditIndependentReviewPair({
    firstSubmission: submission('nutrition-01', 'round', first.packet.items),
    firstPacket: first.packet,
    firstCrosswalk: first.crosswalk,
    secondSubmission: submission('nutrition-02', 'round', second.packet.items),
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
  });
  const queue = buildAdjudicationQueue({
    audit,
    roundId: 'study2-domain-review-round-v2',
    materialVersion: 'study2-candidates-v0.6',
    panelId: 'sports-nutrition',
    generatedAt: '2026-08-02T13:00:00Z',
  });
  assert.deepEqual(queue.items, []);
});
