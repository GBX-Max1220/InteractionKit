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
});

test('unreviewed candidates cannot be mistaken for pilot-ready materials', () => {
  const audit = auditCandidatePool(STUDY2_CANDIDATES);

  assert.equal(audit.pilotReady, false);
  assert.equal(
    audit.warnings.filter((warning) => warning.includes('fewer than two evidence sources')).length,
    32,
  );
  assert.equal(
    audit.warnings.filter((warning) => warning.includes('fewer than two independent domain reviews'))
      .length,
    32,
  );
  assert.match(audit.warnings.at(-1) ?? '', /not pilot-ready/);
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
