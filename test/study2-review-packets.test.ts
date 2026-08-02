import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { generateReviewerPacket } from '../src/study2/review-packets';

test('review packets are deterministic, complete, and crosswalk every candidate once', () => {
  const options = { candidates: STUDY2_CANDIDATES, reviewerId: 'reviewer-a', seed: 'review-v1' };
  const first = generateReviewerPacket(options);
  const second = generateReviewerPacket(options);

  assert.deepEqual(first, second);
  assert.equal(first.packet.items.length, 32);
  assert.equal(new Set(first.packet.items.map((item) => item.blindId)).size, 32);
  assert.equal(new Set(first.crosswalk.map((item) => item.candidateId)).size, 32);
  assert.deepEqual(
    new Set(first.crosswalk.map((item) => item.candidateId)),
    new Set(STUDY2_CANDIDATES.map((candidate) => candidate.id)),
  );
});

test('reviewer-specific randomization yields different candidate orders', () => {
  const first = generateReviewerPacket({
    candidates: STUDY2_CANDIDATES,
    reviewerId: 'reviewer-a',
    seed: 'review-v1',
  });
  const second = generateReviewerPacket({
    candidates: STUDY2_CANDIDATES,
    reviewerId: 'reviewer-b',
    seed: 'review-v1',
  });

  assert.notDeepEqual(
    first.crosswalk.map((item) => item.candidateId),
    second.crosswalk.map((item) => item.candidateId),
  );
});

test('reviewer-visible packet excludes provisional labels and author judgments', () => {
  const { packet } = generateReviewerPacket({
    candidates: STUDY2_CANDIDATES,
    reviewerId: 'reviewer-a',
    seed: 'review-v1',
  });
  const serialized = JSON.stringify(packet);

  assert.doesNotMatch(serialized, /provisionalSupportLevel|authoringNotes|intendedDecisionBoundary/);
  assert.doesNotMatch(serialized, /intendedNumericalGranularity|candidate_unreviewed/);
  assert.doesNotMatch(serialized, /strong_\d|mixed_\d/);
});

test('review packet generation rejects incomplete pools and missing identities', () => {
  assert.throws(
    () => generateReviewerPacket({ candidates: STUDY2_CANDIDATES.slice(1), reviewerId: 'r', seed: 's' }),
    /exactly 32/,
  );
  assert.throws(
    () => generateReviewerPacket({ candidates: STUDY2_CANDIDATES, reviewerId: '', seed: 's' }),
    /Reviewer ID/,
  );
});
