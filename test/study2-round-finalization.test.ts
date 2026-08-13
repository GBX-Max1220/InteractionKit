import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdjudicationQueue } from '../src/study2/adjudication';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { generateReviewerPacket } from '../src/study2/review-packets';
import { auditIndependentReviewPair, type ReviewSubmission } from '../src/study2/review-submissions';
import { finalizeReviewRound, type StoredPairAudit } from '../src/study2/round-finalization';

const roundId = 'study2-domain-review-round-v2';
const materialVersion = 'study2-candidates-v0.6';
const candidates = STUDY2_CANDIDATES.filter(
  (candidate) => candidate.status === 'source_dossier_complete' && candidate.domain === 'injury_risk',
);

function submission(reviewerId: string, packetSeed: string, blindIds: string[]): ReviewSubmission {
  return {
    schemaVersion: 'study2-domain-review-submission-v3',
    materialVersion,
    reviewerId,
    packetSeed,
    relevantExpertise: 'Sports medicine expertise.',
    conflictOfInterestStatement: 'No relevant conflict.',
    submittedAt: '2026-08-02T12:00:00Z',
    items: blindIds.map((blindId) => ({
      blindId,
      binaryDecision: 'option_a',
      supportLevel: 'strong_consensus',
      decisionBoundary: 'Reviewer-defined boundary.',
      numericalGranularity: 'Direction only.',
      sourceConcernIdentified: false,
      sourceConcern: 'None identified.',
      recommendation: 'retain',
      rationale: 'The supplied evidence supports this judgment.',
    })),
  };
}

function fixture() {
  const first = generateReviewerPacket({ candidates, reviewerId: 'sports-medicine-01', seed: 'round' });
  const second = generateReviewerPacket({ candidates, reviewerId: 'sports-medicine-02', seed: 'round' });
  const audit = auditIndependentReviewPair({
    firstSubmission: submission('sports-medicine-01', 'round', first.packet.items.map((item) => item.blindId)),
    firstPacket: first.packet,
    firstCrosswalk: first.crosswalk,
    secondSubmission: submission('sports-medicine-02', 'round', second.packet.items.map((item) => item.blindId)),
    secondPacket: second.packet,
    secondCrosswalk: second.crosswalk,
  });
  const storedAudit: StoredPairAudit = {
    schemaVersion: 'study2-domain-review-pair-audit-v1',
    roundId,
    materialVersion,
    auditedAt: '2026-08-02T13:00:00Z',
    ...audit,
  };
  const queue = buildAdjudicationQueue({
    audit,
    roundId,
    materialVersion,
    panelId: 'sports-medicine',
    generatedAt: storedAudit.auditedAt,
  });
  return { storedAudit, queue };
}

test('round finalization requires exact panel and candidate coverage', () => {
  const { storedAudit, queue } = fixture();
  const result = finalizeReviewRound({
    expectedRoundId: roundId,
    expectedMaterialVersion: materialVersion,
    expectedPanelIds: ['sports-medicine'],
    expectedCandidateIds: candidates.map((candidate) => candidate.id),
    panels: [{ panelId: 'sports-medicine', audit: storedAudit, queue }],
  });
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.outcomes.length, candidates.length);
  assert.equal(result.panels[0].fullAgreement, candidates.length);
});

test('round finalization rejects a queue edited after the pair audit', () => {
  const { storedAudit, queue } = fixture();
  queue.items.push({
    candidateId: candidates[0].id,
    status: 'pending',
    triggers: {
      decisionDisagreementOrUnresolved: true,
      supportDisagreementOrUnresolved: false,
      decisionBoundaryDisagreement: false,
      numericalGranularityDisagreement: false,
      recommendationNotRetain: false,
      sourceConcernIdentified: false,
    },
    firstReview: storedAudit.items[0].first,
    secondReview: storedAudit.items[0].second,
  });
  const result = finalizeReviewRound({
    expectedRoundId: roundId,
    expectedMaterialVersion: materialVersion,
    expectedPanelIds: ['sports-medicine'],
    expectedCandidateIds: candidates.map((candidate) => candidate.id),
    panels: [{ panelId: 'sports-medicine', audit: storedAudit, queue }],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /queue does not match its pair audit/);
});

test('round finalization cannot silently omit an expertise panel', () => {
  const result = finalizeReviewRound({
    expectedRoundId: roundId,
    expectedMaterialVersion: materialVersion,
    expectedPanelIds: ['sports-medicine'],
    expectedCandidateIds: candidates.map((candidate) => candidate.id),
    panels: [],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /do not exactly cover the expected expertise panels/);
  assert.match(result.errors.join('\n'), /do not exactly cover the expected candidate set/);
});
