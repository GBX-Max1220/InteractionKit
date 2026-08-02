import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type ReviewerAssignmentRequirement,
  type ReviewerRoster,
  validateReviewerRoster,
} from '../src/study2/reviewer-roster';

const assignments: ReviewerAssignmentRequirement[] = [
  {
    reviewerId: 'sports-nutrition-reviewer-01',
    panelId: 'sports-nutrition',
    requiredDomains: ['nutrition'],
  },
  {
    reviewerId: 'sports-nutrition-reviewer-02',
    panelId: 'sports-nutrition',
    requiredDomains: ['nutrition'],
  },
];

function validRoster(): ReviewerRoster {
  return {
    schemaVersion: 'study2-reviewer-roster-v1',
    roundId: 'study2-domain-review-round-v2',
    entries: assignments.map((assignment, index) => ({
      reviewerId: assignment.reviewerId,
      panelId: assignment.panelId,
      stablePersonId: `private-person-${index + 1}`,
      qualifiedDomains: [...assignment.requiredDomains],
      relevantQualifications: 'Documented sports-nutrition research or practice expertise.',
      conflictOfInterestStatement: 'No relevant conflict identified.',
      independenceAttestation: 'Will review independently without access to the paired response.',
      eligibilityDecision: 'eligible',
      verifiedBy: 'protocol-maintainer',
      verifiedAt: '2026-08-02T12:00:00Z',
    })),
  };
}

test('reviewer roster binds every assignment to a qualified independent person', () => {
  const validation = validateReviewerRoster(validRoster(), {
    roundId: 'study2-domain-review-round-v2',
    assignments,
  });
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('same person cannot occupy both independent seats in one panel', () => {
  const roster = validRoster();
  roster.entries[1].stablePersonId = roster.entries[0].stablePersonId.toUpperCase();
  const validation = validateReviewerRoster(roster, {
    roundId: roster.roundId,
    assignments,
  });
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /same person to both independent reviewer seats/);
});

test('missing panel expertise or eligibility fails roster validation', () => {
  const roster = validRoster();
  roster.entries[0].qualifiedDomains = [];
  roster.entries[1].eligibilityDecision = 'ineligible';
  const validation = validateReviewerRoster(roster, {
    roundId: roster.roundId,
    assignments,
  });
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /required expertise in nutrition/);
  assert.match(validation.errors.join('\n'), /not marked eligible/);
});
