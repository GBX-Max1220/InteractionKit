import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FinalReviewOutcome } from '../src/study2/adjudication';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditFinalFreeze, type FinalFreezeSelection } from '../src/study2/final-freeze';

type OutcomeArtifact = {
  schemaVersion: 'study2-final-review-outcomes-v1';
  roundId: string;
  materialVersion: string;
  outcomes: FinalReviewOutcome[];
};

const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name} <file.json>.`);
  return path.resolve(value);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function main(): Promise<void> {
  const selectionPath = requiredArgument('--selection');
  const outcomeArtifact = await readJson<OutcomeArtifact>(
    path.join(privateDirectory, 'final-review-outcomes.json'),
  );
  if (
    outcomeArtifact.schemaVersion !== 'study2-final-review-outcomes-v1' ||
    outcomeArtifact.materialVersion !== 'study2-candidates-v0.6' ||
    !Array.isArray(outcomeArtifact.outcomes)
  ) {
    throw new Error('Private final-review outcome artifact is invalid or mismatched.');
  }
  const selection = await readJson<FinalFreezeSelection>(selectionPath);
  const audit = auditFinalFreeze({
    candidates: STUDY2_CANDIDATES,
    outcomes: outcomeArtifact.outcomes,
    selection,
    expectedRoundId: outcomeArtifact.roundId,
  });
  const outputPath = path.join(privateDirectory, 'final-freeze-audit.json');
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 'study2-final-freeze-audit-v1',
        roundId: outcomeArtifact.roundId,
        materialVersion: outcomeArtifact.materialVersion,
        auditedAt: new Date().toISOString(),
        sourceSelectionFile: path.basename(selectionPath),
        ...audit,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  if (!audit.valid) throw new Error(`Final freeze is invalid:\n${audit.errors.join('\n')}`);
  console.log(JSON.stringify({ valid: true, counts: audit.counts, privateAudit: outputPath }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
