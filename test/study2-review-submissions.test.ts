import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { generateReviewerPacket } from '../src/study2/review-packets';
import {
  auditIndependentReviewPair,
  type ReviewSubmission,
  validateReviewSubmission,
} from '../src/study2/review-submissions';

const reviewable = STUDY2_CANDIDATES.filter(
  (candidate) => candidate.status === 'source_dossier_complete',
);

function submissionFor(
  reviewerId: string,
  packetSeed: string,
  items: { blindId: string }[],
): ReviewSubmission {
  return {
    schemaVersion: 'study2-domain-review-submission-v3',
    materialVersion: 'study2-candidates-v0.6',
    reviewerId,
    packetSeed,
    relevantExpertise: 'Exercise and sport science domain expertise.',
    conflictOfInterestStatement: 'No relevant conflict declared for this test fixture.',
    submittedAt: '2026-08-02T12:00:00Z',
    items: items.map((item) => ({
      blindId: item.blindId,
      binaryDecision: 'option_a',
      supportLevel: 'strong_consensus',
      decisionBoundary: 'Boundary supplied independently by reviewer.',
      numericalGranularity: 'Direction only.',
      sourceConcernIdentified: false,
      sourceConcern: 'None identified.',
      recommendation: 'retain',
      rationale: 'Evidence and scenario context support this judgment.',
    })),
  };
}

test('review submission must exactly cover its blinded packet', () => {
  const generated = generateReviewerPacket({
    candidates: reviewable,
    reviewerId: 'reviewer-a',
    seed: 'review-v1',
  });
  const submission = submissionFor(
    generated.packet.reviewerId,
    generated.packet.packetSeed,
    generated.packet.items,
  );
  assert.equal(validateReviewSubmission(submission, generated.packet).valid, true);

  const incomplete = { ...submission, items: submission.items.slice(1) };
  assert.match(
    validateReviewSubmission(incomplete, generated.packet).errors.join('\n'),
    /Expected 27 review items|missing S\d+/,
  );

  const leaking = {
    ...submission,
    items: submission.items.map((item, index) =>
      index === 0 ? { ...item, candidateId: 'strong_01' } : item,
    ),
  } as ReviewSubmission;
  assert.match(
    validateReviewSubmission(leaking, generated.packet).errors.join('\n'),
    /unexpected fields: candidateId/,
  );

  const missingSourceConcern = {
    ...submission,
    items: submission.items.map(({ sourceConcern, ...item }, index) =>
      index === 0 ? item : { ...item, sourceConcern },
    ),
  };
  assert.match(
    validateReviewSubmission(missingSourceConcern, generated.packet).errors.join('\n'),
    /S\d+ is missing required written justification/,
  );

  const unsafeRetain = {
    ...submission,
    items: submission.items.map((item, index) =>
      index === 0
        ? {
            ...item,
            sourceConcernIdentified: true,
            sourceConcern: 'The supplied source does not match the target population.',
          }
        : item,
    ),
  };
  assert.match(
    validateReviewSubmission(unsafeRetain, generated.packet).errors.join('\n'),
    /cannot be retained while a source concern is identified/,
  );
});

test('malformed JSON values fail validation without throwing', () => {
  const generated = generateReviewerPacket({
    candidates: reviewable,
    reviewerId: 'reviewer-a',
    seed: 'review-v1',
  });
  assert.deepEqual(validateReviewSubmission(null, generated.packet), {
    valid: false,
    errors: ['Submission must be a JSON object.'],
  });
  const malformed = {
    reviewerId: 'reviewer-a',
    items: [null, { blindId: 4 }],
  };
  const validation = validateReviewSubmission(malformed, generated.packet);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /Review item 1 must be a JSON object/);
  assert.match(validation.errors.join('\n'), /Item 2 has an invalid binary decision/);
});

test('review pair detects disagreements after reviewer-specific unblinding', () => {
  const first = generateReviewerPacket({
    candidates: reviewable,
    reviewerId: 'reviewer-a',
    seed: 'review-v1',
  });
  const second = generateReviewerPacket({
    candidates: reviewable,
    reviewerId: 'reviewer-b',
    seed: 'review-v1',
  });
  const firstSubmission = submissionFor(
    first.packet.reviewerId,
    first.packet.packetSeed,
    first.packet.items,
  );
  const secondSubmission = submissionFor(
    second.packet.reviewerId,
    second.packet.packetSeed,
    second.packet.items,
  );
  secondSubmission.items[0] = {
    ...secondSubmission.items[0],
    binaryDecision: 'option_b',
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
  assert.equal(audit.counts.reviewed, 27);
  assert.equal(audit.counts.fullAgreement, 26);
  assert.equal(audit.counts.adjudicationRequired, 1);
});

test('same reviewer cannot satisfy independence', () => {
  const generated = generateReviewerPacket({
    candidates: reviewable,
    reviewerId: 'reviewer-a',
    seed: 'review-v1',
  });
  const submission = submissionFor(
    generated.packet.reviewerId,
    generated.packet.packetSeed,
    generated.packet.items,
  );
  const audit = auditIndependentReviewPair({
    firstSubmission: submission,
    firstPacket: generated.packet,
    firstCrosswalk: generated.crosswalk,
    secondSubmission: submission,
    secondPacket: generated.packet,
    secondCrosswalk: generated.crosswalk,
  });
  assert.equal(audit.valid, false);
  assert.match(audit.errors.join('\n'), /two distinct reviewer IDs/);
});
