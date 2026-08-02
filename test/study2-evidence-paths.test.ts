import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditEvidencePaths, STUDY2_EVIDENCE_PATHS } from '../src/study2/evidence-paths';

test('evidence-path registry has unique verified provenance for all triaged candidates', () => {
  const audit = auditEvidencePaths(STUDY2_EVIDENCE_PATHS, STUDY2_CANDIDATES);

  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.counts.registered, 27);
  assert.equal(audit.counts.readyForDossier, 26);
  assert.deepEqual(audit.sourceGapCandidateIds, ['strong_11']);
});

test('evidence-path audit rejects duplicate or non-supporting provenance', () => {
  const first = STUDY2_EVIDENCE_PATHS[0];
  const duplicateSource = {
    ...first,
    sources: [first.sources[0], { ...first.sources[0] }] as typeof first.sources,
  };
  const duplicatePath = [first, { ...first }];

  assert.match(
    auditEvidencePaths([duplicateSource], STUDY2_CANDIDATES).errors.join('\n'),
    /repeats a DOI or PMID/,
  );
  assert.match(
    auditEvidencePaths(duplicatePath, STUDY2_CANDIDATES).errors.join('\n'),
    /Duplicate evidence path/,
  );
});
