import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditEvidenceDossiers, STUDY2_EVIDENCE_DOSSIERS } from '../src/study2/evidence-dossiers';
import { STUDY2_EVIDENCE_PATHS } from '../src/study2/evidence-paths';

test('first evidence-dossier batch has complete source-to-claim mappings', () => {
  const audit = auditEvidenceDossiers(STUDY2_EVIDENCE_DOSSIERS, STUDY2_CANDIDATES, STUDY2_EVIDENCE_PATHS);

  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.deepEqual(audit.counts, { complete: 5, strong: 5, mixed: 0 });
});

test('dossier audit rejects a source not registered in provenance', () => {
  const first = STUDY2_EVIDENCE_DOSSIERS[0];
  const invalid = {
    ...first,
    sources: [
      { ...first.sources[0], doi: '10.0000/unregistered', pmid: '99999999' },
      first.sources[1],
    ] as typeof first.sources,
  };
  const audit = auditEvidenceDossiers([invalid], STUDY2_CANDIDATES, STUDY2_EVIDENCE_PATHS);

  assert.match(audit.errors.join('\n'), /absent from the provenance registry/);
});
