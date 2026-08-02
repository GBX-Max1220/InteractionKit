import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditCandidatePool } from '../src/study2/materials';

test('candidate registry freezes a structurally valid balanced pool of 32', () => {
  const audit = auditCandidatePool(STUDY2_CANDIDATES);

  assert.equal(audit.structurallyValid, true, audit.errors.join('\n'));
  assert.equal(STUDY2_CANDIDATES.length, 32);
  assert.equal(audit.counts.strong_consensus, 16);
  assert.equal(audit.counts.mixed_or_conditional, 16);
  assert.equal(
    audit.errors.filter((error) => error.includes('participant-visible shortcut cue')).length,
    0,
  );
});

test('source-complete candidates cannot be mistaken for reviewed pilot materials', () => {
  const audit = auditCandidatePool(STUDY2_CANDIDATES);

  assert.equal(audit.pilotReady, false);
  assert.equal(
    audit.warnings.filter((warning) => warning.includes('fewer than two evidence sources')).length,
    5,
  );
  assert.equal(
    audit.warnings.filter((warning) => warning.includes('fewer than two independent domain reviews'))
      .length,
    32,
  );
  assert.equal(
    STUDY2_CANDIDATES.filter((scenario) => scenario.status === 'source_dossier_complete').length,
    27,
  );
  assert.equal(
    STUDY2_CANDIDATES.filter((scenario) => scenario.status === 'candidate_unreviewed').length,
    5,
  );
  assert.match(audit.warnings.at(-1) ?? '', /not pilot-ready/);
});

test('provisional answer sides are not aliased with evidence-support level', () => {
  const strong = STUDY2_CANDIDATES.filter(
    (scenario) => scenario.provisionalSupportLevel === 'strong_consensus',
  );
  const mixed = STUDY2_CANDIDATES.filter(
    (scenario) => scenario.provisionalSupportLevel === 'mixed_or_conditional',
  );

  assert.equal(strong.filter((scenario) => scenario.provisionalCorrectOption === 'option_a').length, 8);
  assert.equal(strong.filter((scenario) => scenario.provisionalCorrectOption === 'option_b').length, 8);
  assert.ok(mixed.some((scenario) => scenario.provisionalCorrectOption === 'option_a'));
  assert.ok(mixed.some((scenario) => scenario.provisionalCorrectOption === 'option_b'));
  assert.ok(mixed.some((scenario) => scenario.provisionalCorrectOption === 'unresolved'));
});

test('retained status cannot bypass evidence and independent review gates', () => {
  const invalidPool = STUDY2_CANDIDATES.map((scenario, index) => ({
    ...scenario,
    status: index === 0 ? ('retained_v1' as const) : scenario.status,
  }));
  const audit = auditCandidatePool(invalidPool);

  assert.equal(audit.structurallyValid, false);
  assert.match(audit.errors.join('\n'), /marked retained_v1 without complete, agreeing evidence/);
  assert.equal(audit.pilotReady, false);
});

test('retained status requires distinct supporting sources and distinct agreeing reviewers', () => {
  const base = STUDY2_CANDIDATES[0];
  const source = {
    id: 'source_1',
    citation: 'Verified source 1',
    urlOrDoi: 'https://doi.org/10.0000/source-1',
    authorityType: 'systematic_review' as const,
    supportsBinaryDecision: true,
    supportsEvidenceLevel: true,
    verifiedBy: 'metadata-auditor',
    verifiedAt: '2026-08-02T00:00:00Z',
  };
  const review = {
    reviewerId: 'reviewer_1',
    independent: true,
    binaryDecision: base.provisionalCorrectOption,
    supportLevel: base.provisionalSupportLevel,
    decisionBoundary: base.intendedDecisionBoundary,
    numericalGranularity: base.intendedNumericalGranularity,
    reviewedAt: '2026-08-02T00:00:00Z',
  };
  const retained = {
    ...base,
    status: 'retained_v1' as const,
    evidenceSources: [
      source,
      {
        ...source,
        id: 'source_2',
        citation: 'Verified source 2',
        urlOrDoi: 'https://doi.org/10.0000/source-2',
      },
    ],
    domainReviews: [review, { ...review, reviewerId: 'reviewer_2' }],
  };

  const supportingAudit = auditCandidatePool([
    retained,
    ...STUDY2_CANDIDATES.slice(1),
  ]);
  assert.doesNotMatch(
    supportingAudit.errors.join('\n'),
    /marked retained_v1 without complete, agreeing evidence/,
  );

  const unsupportedAudit = auditCandidatePool([
    {
      ...retained,
      evidenceSources: [source, { ...source, supportsBinaryDecision: false }],
    },
    ...STUDY2_CANDIDATES.slice(1),
  ]);
  assert.match(
    unsupportedAudit.errors.join('\n'),
    /marked retained_v1 without complete, agreeing evidence/,
  );

  const duplicateReviewerAudit = auditCandidatePool([
    { ...retained, domainReviews: [review, { ...review }] },
    ...STUDY2_CANDIDATES.slice(1),
  ]);
  assert.match(
    duplicateReviewerAudit.errors.join('\n'),
    /marked retained_v1 without complete, agreeing evidence/,
  );

  const mismatchedReviewAudit = auditCandidatePool([
    {
      ...retained,
      domainReviews: [
        { ...review, binaryDecision: 'option_b' as const },
        { ...review, reviewerId: 'reviewer_2', binaryDecision: 'option_b' as const },
      ],
    },
    ...STUDY2_CANDIDATES.slice(1),
  ]);
  assert.match(
    mismatchedReviewAudit.errors.join('\n'),
    /marked retained_v1 without complete, agreeing evidence/,
  );
});
