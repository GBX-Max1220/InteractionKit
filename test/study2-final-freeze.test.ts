import assert from 'node:assert/strict';
import test from 'node:test';

import type { FinalReviewOutcome } from '../src/study2/adjudication';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditFinalFreeze, type FinalFreezeSelection } from '../src/study2/final-freeze';

const candidates = STUDY2_CANDIDATES.filter(
  (candidate) => candidate.status === 'source_dossier_complete',
);

function fixture(): { outcomes: FinalReviewOutcome[]; selection: FinalFreezeSelection } {
  const outcomes = candidates.map((candidate, index): FinalReviewOutcome => {
    const selectedIndex = index < 24 ? index : index - 24;
    const support = selectedIndex < 12 ? 'strong_consensus' : 'mixed_or_conditional';
    const withinSupport = selectedIndex % 12;
    return {
      candidateId: candidate.id,
      disposition: 'retain',
      finalBinaryDecision: withinSupport < 6 ? 'option_a' : 'option_b',
      finalSupportLevel: support,
      finalDecisionBoundary: 'Final reviewer-supported decision boundary.',
      finalNumericalGranularity: 'Direction only.',
      basis: 'full_reviewer_agreement',
    };
  });
  return {
    outcomes,
    selection: {
      schemaVersion: 'study2-final-freeze-selection-v1',
      roundId: 'study2-domain-review-round-v2',
      materialVersion: 'study2-candidates-v0.6',
      selectedCandidateIds: outcomes.slice(0, 24).map((outcome) => outcome.candidateId),
      selectionRule: 'Apply the preregistered balance constraints, then domain coverage and reading-burden criteria without access to participant outcomes.',
      exclusions: outcomes.slice(24).map((outcome) => ({
        candidateId: outcome.candidateId,
        reason: 'Eligible reserve not required after the preregistered balanced set was filled.',
      })),
      selectedBy: 'protocol-maintainer',
      selectedAt: '2026-08-02T14:00:00Z',
    },
  };
}

test('final freeze requires the exact 24-item 12/12 and within-level 6/6 balance', () => {
  const { outcomes, selection } = fixture();
  const audit = auditFinalFreeze({
    candidates: STUDY2_CANDIDATES,
    outcomes,
    selection,
    expectedRoundId: 'study2-domain-review-round-v2',
  });
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.counts.selected, 24);
  assert.equal(audit.counts.support.strong_consensus, 12);
  assert.deepEqual(audit.counts.decisionBySupport.mixed_or_conditional, {
    option_a: 6,
    option_b: 6,
  });
});

test('an imbalanced or review-ineligible selection cannot freeze', () => {
  const { outcomes, selection } = fixture();
  outcomes[0] = { ...outcomes[0], disposition: 'revise_and_re_review' };
  outcomes[12] = { ...outcomes[12], finalSupportLevel: 'strong_consensus' };
  const audit = auditFinalFreeze({
    candidates: STUDY2_CANDIDATES,
    outcomes,
    selection,
    expectedRoundId: 'study2-domain-review-round-v2',
  });
  assert.equal(audit.valid, false);
  assert.match(audit.errors.join('\n'), /not eligible for retention/);
  assert.match(audit.errors.join('\n'), /requires 12 mixed_or_conditional/);
});

test('every eligible reserve exclusion requires a recorded reason', () => {
  const { outcomes, selection } = fixture();
  selection.exclusions = [];
  const audit = auditFinalFreeze({
    candidates: STUDY2_CANDIDATES,
    outcomes,
    selection,
    expectedRoundId: 'study2-domain-review-round-v2',
  });
  assert.equal(audit.valid, false);
  assert.match(audit.errors.join('\n'), /requires an exclusion reason/);
});
