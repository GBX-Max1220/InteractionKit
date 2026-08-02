import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdjudicationQueue, AdjudicationResolution } from '../src/study2/adjudication';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import {
  finalizeReviewRound,
  type PanelFinalizationInput,
  type StoredPairAudit,
} from '../src/study2/round-finalization';

type Manifest = {
  roundId: string;
  materialVersion: string;
  candidateCount: number;
  entries: Array<{ panelId: string }>;
};

const publicDirectory = path.resolve('study2', 'review-round-v2');
const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');

async function readJson<T>(file: string): Promise<{ parsed: T; serialized: string }> {
  const serialized = await readFile(file, 'utf8');
  return { parsed: JSON.parse(serialized) as T, serialized };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const manifest = (await readJson<Manifest>(path.join(publicDirectory, 'manifest.json'))).parsed;
  const expectedCandidateIds = STUDY2_CANDIDATES.filter(
    (candidate) => candidate.status === 'source_dossier_complete',
  ).map((candidate) => candidate.id);
  if (expectedCandidateIds.length !== manifest.candidateCount) {
    throw new Error('Manifest candidate count does not match the source-complete registry.');
  }
  const panelIds = [...new Set(manifest.entries.map((entry) => entry.panelId))].sort();
  const panels: PanelFinalizationInput[] = [];
  const sourceArtifacts: Array<{
    panelId: string;
    pairAuditSha256: string;
    adjudicationQueueSha256: string;
    adjudicationResolutionSha256: string | null;
  }> = [];
  for (const panelId of panelIds) {
    const auditArtifact = await readJson<StoredPairAudit>(
      path.join(privateDirectory, `${panelId}.pair-audit.json`),
    );
    const queueArtifact = await readJson<AdjudicationQueue>(
      path.join(privateDirectory, `${panelId}.adjudication-queue.json`),
    );
    const resolutionPath = path.join(privateDirectory, `${panelId}.adjudication-resolution.json`);
    const resolutionArtifact = (await exists(resolutionPath))
      ? await readJson<AdjudicationResolution>(resolutionPath)
      : undefined;
    panels.push({
      panelId,
      audit: auditArtifact.parsed,
      queue: queueArtifact.parsed,
      resolution: resolutionArtifact?.parsed,
    });
    sourceArtifacts.push({
      panelId,
      pairAuditSha256: sha256(auditArtifact.serialized),
      adjudicationQueueSha256: sha256(queueArtifact.serialized),
      adjudicationResolutionSha256: resolutionArtifact
        ? sha256(resolutionArtifact.serialized)
        : null,
    });
  }
  const result = finalizeReviewRound({
    expectedRoundId: manifest.roundId,
    expectedMaterialVersion: manifest.materialVersion,
    expectedPanelIds: panelIds,
    expectedCandidateIds,
    panels,
  });
  if (!result.valid) throw new Error(result.errors.join('\n'));
  const outputPath = path.join(privateDirectory, 'final-review-outcomes.json');
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 'study2-final-review-outcomes-v1',
        roundId: manifest.roundId,
        materialVersion: manifest.materialVersion,
        finalizedAt: new Date().toISOString(),
        sourceArtifacts,
        panels: result.panels,
        outcomes: result.outcomes,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(JSON.stringify({ valid: true, outcomes: result.outcomes.length, privateOutput: outputPath }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
