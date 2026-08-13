import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FinalReviewOutcome } from '../src/study2/adjudication';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditFinalFreeze, type FinalFreezeSelection } from '../src/study2/final-freeze';
import { buildFrozenMaterials } from '../src/study2/frozen-materials';

type OutcomeArtifact = {
  schemaVersion: 'study2-final-review-outcomes-v1';
  roundId: string;
  materialVersion: string;
  outcomes: FinalReviewOutcome[];
};

type FreezeAuditArtifact = {
  schemaVersion: 'study2-final-freeze-audit-v1';
  valid: boolean;
  sourceOutcomeFile: string;
  sourceOutcomeSha256: string;
  sourceSelectionFile: string;
  sourceSelectionSha256: string;
};

const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readJson<T>(file: string): Promise<{ parsed: T; serialized: string }> {
  const serialized = await readFile(file, 'utf8');
  return { parsed: JSON.parse(serialized) as T, serialized };
}

async function main(): Promise<void> {
  const auditArtifact = (
    await readJson<FreezeAuditArtifact>(path.join(privateDirectory, 'final-freeze-audit.json'))
  ).parsed;
  if (auditArtifact.schemaVersion !== 'study2-final-freeze-audit-v1' || !auditArtifact.valid) {
    throw new Error('A valid final-freeze audit is required before export.');
  }
  if (
    path.basename(auditArtifact.sourceOutcomeFile) !== auditArtifact.sourceOutcomeFile ||
    path.basename(auditArtifact.sourceSelectionFile) !== auditArtifact.sourceSelectionFile
  ) {
    throw new Error('Final-freeze source references must be private-directory basenames.');
  }
  const outcomeSource = await readJson<OutcomeArtifact>(
    path.join(privateDirectory, auditArtifact.sourceOutcomeFile),
  );
  const selectionSource = await readJson<FinalFreezeSelection>(
    path.join(privateDirectory, auditArtifact.sourceSelectionFile),
  );
  if (
    sha256(outcomeSource.serialized) !== auditArtifact.sourceOutcomeSha256 ||
    sha256(selectionSource.serialized) !== auditArtifact.sourceSelectionSha256
  ) {
    throw new Error('Final-freeze inputs no longer match the audited SHA-256 bindings.');
  }
  const outcomeArtifact = outcomeSource.parsed;
  if (
    outcomeArtifact.schemaVersion !== 'study2-final-review-outcomes-v1' ||
    outcomeArtifact.materialVersion !== 'study2-candidates-v0.6' ||
    !Array.isArray(outcomeArtifact.outcomes)
  ) {
    throw new Error('Audited final-review outcome artifact is invalid or mismatched.');
  }
  const audit = auditFinalFreeze({
    candidates: STUDY2_CANDIDATES,
    outcomes: outcomeArtifact.outcomes,
    selection: selectionSource.parsed,
    expectedRoundId: outcomeArtifact.roundId,
  });
  const artifact = buildFrozenMaterials({
    candidates: STUDY2_CANDIDATES,
    audit,
    roundId: outcomeArtifact.roundId,
    materialVersion: outcomeArtifact.materialVersion,
    sourceOutcomeSha256: auditArtifact.sourceOutcomeSha256,
    sourceSelectionSha256: auditArtifact.sourceSelectionSha256,
  });
  const outputPath = path.join(privateDirectory, 'frozen-materials-v1.json');
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ valid: true, items: artifact.items.length, privateOutput: outputPath }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
