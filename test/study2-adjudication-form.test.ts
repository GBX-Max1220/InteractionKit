import assert from 'node:assert/strict';
import test from 'node:test';

import type { AdjudicationQueue } from '../src/study2/adjudication';
import {
  buildAdjudicationTemplate,
  renderAdjudicationForm,
} from '../src/study2/adjudication-form';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';

const candidate = STUDY2_CANDIDATES.find(
  (item) => item.status === 'source_dossier_complete',
)!;
const baseReview = {
  blindId: 'S01',
  candidateId: candidate.id,
  reviewerId: 'reviewer-01',
  reviewedAt: '2026-08-02T12:00:00Z',
  binaryDecision: 'option_a' as const,
  supportLevel: 'strong_consensus' as const,
  decisionBoundary: 'Original boundary.',
  numericalGranularity: 'Direction only.',
  sourceConcernIdentified: false,
  sourceConcern: 'None identified.',
  recommendation: 'retain' as const,
  rationale: 'Evidence-linked rationale.',
};
const queue: AdjudicationQueue = {
  schemaVersion: 'study2-adjudication-queue-v1',
  roundId: 'study2-domain-review-round-v2',
  materialVersion: 'study2-candidates-v0.6',
  panelId: 'exercise-physiology',
  generatedAt: '2026-08-02T13:00:00Z',
  items: [
    {
      candidateId: candidate.id,
      status: 'pending',
      triggers: {
        decisionDisagreementOrUnresolved: true,
        supportDisagreementOrUnresolved: false,
        decisionBoundaryDisagreement: true,
        numericalGranularityDisagreement: false,
        recommendationNotRetain: true,
        sourceConcernIdentified: true,
      },
      firstReview: baseReview,
      secondReview: {
        ...baseReview,
        reviewerId: 'reviewer-02',
        binaryDecision: 'option_b',
        decisionBoundary: 'Different boundary.',
        sourceConcernIdentified: true,
        sourceConcern: 'Population mismatch.',
        recommendation: 'revise',
      },
    },
  ],
};

test('adjudication template is deliberately incomplete and non-retaining', () => {
  const thirdExpert = buildAdjudicationTemplate(queue, 'third_expert');
  assert.deepEqual(thirdExpert.resolverIds, []);
  assert.equal(thirdExpert.materialContributionConflict, true);
  assert.equal(thirdExpert.items[0].disposition, 'revise_and_re_review');
  assert.equal(thirdExpert.items[0].finalBinaryDecision, 'unresolved');
  assert.equal(thirdExpert.items[0].rationale, '');

  const consensus = buildAdjudicationTemplate(queue, 'reviewer_consensus_after_lock');
  assert.deepEqual(consensus.resolverIds, ['reviewer-01', 'reviewer-02']);
});

test('offline adjudication form preserves locked reviews without author-label leakage', () => {
  const html = renderAdjudicationForm({
    queue,
    candidates: STUDY2_CANDIDATES,
    method: 'third_expert',
  });
  assert.match(html, /This file sends no data to a server/);
  assert.match(html, /study2-adjudication-resolution-v1/);
  assert.match(html, /Population mismatch/);
  assert.match(html, /sourceConcernIdentified/);
  assert.match(html, /cannot be retained while a source concern exists/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  for (const forbidden of [
    'provisionalCorrectOption',
    'provisionalSupportLevel',
    'authoringNotes',
    'intendedDecisionBoundary',
  ]) {
    assert.equal(html.includes(forbidden), false, forbidden);
  }
});
