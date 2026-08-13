import assert from 'node:assert/strict';
import test from 'node:test';

import type { FinalReviewOutcome } from '../src/study2/adjudication';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditFinalFreeze, type FinalFreezeSelection } from '../src/study2/final-freeze';
import { buildFrozenMaterials } from '../src/study2/frozen-materials';

const candidates = STUDY2_CANDIDATES.filter(
  (candidate) => candidate.status === 'source_dossier_complete',
);

function fixture() {
  const outcomes = candidates.map((candidate, index): FinalReviewOutcome => {
    const position = index < 24 ? index : index - 24;
    return {
      candidateId: candidate.id,
      disposition: 'retain',
      finalBinaryDecision: position % 12 < 6 ? 'option_a' : 'option_b',
      finalSupportLevel: position < 12 ? 'strong_consensus' : 'mixed_or_conditional',
      finalDecisionBoundary: 'Final boundary.',
      finalNumericalGranularity: 'Direction only.',
      basis: 'full_reviewer_agreement',
    };
  });
  const selection: FinalFreezeSelection = {
    schemaVersion: 'study2-final-freeze-selection-v1',
    roundId: 'study2-domain-review-round-v2',
    materialVersion: 'study2-candidates-v0.6',
    selectedCandidateIds: outcomes.slice(0, 24).map((outcome) => outcome.candidateId),
    selectionRule: 'Predeclared structural balance, then domain coverage.',
    exclusions: outcomes.slice(24).map((outcome) => ({
      candidateId: outcome.candidateId,
      reason: 'Eligible reserve not required for the balanced set.',
    })),
    selectedBy: 'protocol-maintainer',
    selectedAt: '2026-08-02T15:00:00Z',
  };
  return {
    audit: auditFinalFreeze({
      candidates: STUDY2_CANDIDATES,
      outcomes,
      selection,
      expectedRoundId: selection.roundId,
    }),
  };
}

test('frozen export contains exactly the audited materials without reviewer identity data', () => {
  const { audit } = fixture();
  const artifact = buildFrozenMaterials({
    candidates: STUDY2_CANDIDATES,
    audit,
    roundId: 'study2-domain-review-round-v2',
    materialVersion: 'study2-candidates-v0.6',
    sourceOutcomeSha256: 'a'.repeat(64),
    sourceSelectionSha256: 'b'.repeat(64),
  });
  assert.equal(artifact.items.length, 24);
  assert.deepEqual(
    artifact.items.map((item) => item.candidateId).sort(),
    audit.selectedOutcomes.map((outcome) => outcome.candidateId).sort(),
  );
  const serialized = JSON.stringify(artifact);
  assert.doesNotMatch(serialized, /reviewerId|resolverId|selectedBy|conflictOfInterest/);
});

test('frozen export rejects invalid audit evidence or source hashes', () => {
  const { audit } = fixture();
  assert.throws(
    () =>
      buildFrozenMaterials({
        candidates: STUDY2_CANDIDATES,
        audit: { ...audit, valid: false },
        roundId: 'study2-domain-review-round-v2',
        materialVersion: 'study2-candidates-v0.6',
        sourceOutcomeSha256: 'a'.repeat(64),
        sourceSelectionSha256: 'b'.repeat(64),
      }),
    /invalid final-freeze audit/,
  );
  assert.throws(
    () =>
      buildFrozenMaterials({
        candidates: STUDY2_CANDIDATES,
        audit,
        roundId: 'study2-domain-review-round-v2',
        materialVersion: 'study2-candidates-v0.6',
        sourceOutcomeSha256: 'not-a-hash',
        sourceSelectionSha256: 'b'.repeat(64),
      }),
    /valid SHA-256 source bindings/,
  );
});
