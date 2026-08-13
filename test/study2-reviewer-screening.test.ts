import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  REVIEW_PANEL_REQUIREMENTS,
  renderRecruitmentInvitation,
  renderReviewerScreeningForm,
  validateReviewerScreeningResponse,
  type ReviewerScreeningResponse,
} from '../src/study2/reviewer-screening';

type Manifest = {
  entries: Array<{ panelId: string; requiredDomains: string[]; itemCount: number }>;
};

const compensation = 'Voluntary participation with no payment.';
const validResponse: ReviewerScreeningResponse = {
  schemaVersion: 'study2-reviewer-screening-v1',
  roundId: 'study2-domain-review-round-v2',
  panelId: 'sports-nutrition',
  fullName: 'Private screening fixture',
  contact: 'private@example.invalid',
  institutionalAffiliation: 'Fixture institution',
  qualificationRoute: 'active_doctoral_training',
  qualificationDetails: 'Doctoral training in sports nutrition.',
  publicCredentialUrl: 'https://example.invalid/profile',
  claimedDomains: ['nutrition'],
  conflictOfInterestStatement: 'No relevant conflict.',
  materialContributionConflict: false,
  independenceAttestation: true,
  compensationStatementAccepted: true,
  outcomeContingentCompensation: false,
  disclosedCompensationStatement: compensation,
  submittedAt: '2026-08-02T16:00:00Z',
};

test('recruitment panel requirements exactly match committed assignments', async () => {
  const manifest = JSON.parse(
    await readFile(path.resolve('study2', 'review-round-v2', 'manifest.json'), 'utf8'),
  ) as Manifest;
  for (const requirement of REVIEW_PANEL_REQUIREMENTS) {
    const entries = manifest.entries.filter((entry) => entry.panelId === requirement.panelId);
    assert.equal(entries.length, 2);
    assert.ok(entries.every((entry) => entry.itemCount === requirement.itemCount));
    assert.ok(
      entries.every(
        (entry) =>
          JSON.stringify([...entry.requiredDomains].sort()) ===
          JSON.stringify([...requirement.domains].sort()),
      ),
    );
  }
});

test('screening validation checks hard exclusions but never declares eligibility', () => {
  const valid = validateReviewerScreeningResponse(validResponse, {
    expectedPanelId: 'sports-nutrition',
    expectedCompensationStatement: compensation,
  });
  assert.equal(valid.valid, true, valid.errors.join('\n'));
  assert.equal(valid.requiresManualIdentityAndConflictVerification, true);

  const invalid = validateReviewerScreeningResponse({
    ...validResponse,
    materialContributionConflict: true,
    outcomeContingentCompensation: true,
    disclosedCompensationStatement: 'Different terms.',
  }, {
    expectedPanelId: 'sports-nutrition',
    expectedCompensationStatement: compensation,
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /material contributor/);
  assert.match(invalid.errors.join('\n'), /Compensation cannot depend/);
  assert.match(invalid.errors.join('\n'), /dispatched compensation statement/);
});

test('private recruitment materials are neutral, offline, and do not claim qualification', () => {
  const invitation = renderRecruitmentInvitation({
    panelId: 'sports-nutrition',
    compensationStatement: compensation,
    returnContact: 'private@example.invalid',
  });
  const form = renderReviewerScreeningForm({
    panelId: 'sports-nutrition',
    compensationStatement: compensation,
  });
  assert.match(invitation, /Unresolved and revise judgments are explicitly acceptable/);
  assert.doesNotMatch(
    invitation,
    /\b(?:strong|mixed)_\d{2}\b|Option A|Option B|strong_consensus|mixed_or_conditional/,
  );
  assert.match(form, /This form runs entirely in your browser and sends no data to a server/);
  assert.match(form, /Completing screening does not guarantee eligibility/);
  assert.match(form, /connect-src 'none'/);
  assert.doesNotMatch(form, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
