import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { generateReviewerPacket } from '../src/study2/review-packets';
import type { ReviewSubmission } from '../src/study2/review-submissions';

const roundId = 'study2-domain-review-round-v1';
const seed = 'study2-domain-review-v1-2026-08-02';
const reviewerIds = ['domain-reviewer-01', 'domain-reviewer-02'] as const;
const publicDirectory = path.resolve('study2', 'review-round-v1');
const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v1');

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(serialized: string): string {
  return createHash('sha256').update(serialized).digest('hex');
}

const reviewableCandidates = STUDY2_CANDIDATES.filter(
  (candidate) => candidate.status === 'source_dossier_complete',
);
async function main(): Promise<void> {
  if (reviewableCandidates.length !== 27) {
    throw new Error(`Expected 27 source-complete candidates; found ${reviewableCandidates.length}.`);
  }

  await mkdir(publicDirectory, { recursive: true });
  await mkdir(privateDirectory, { recursive: true });

  const manifestEntries: Array<{
    reviewerId: string;
    packetFile: string;
    submissionTemplateFile: string;
    packetSha256: string;
    submissionTemplateSha256: string;
    privateCrosswalkSha256: string;
  }> = [];

  for (const reviewerId of reviewerIds) {
    const generated = generateReviewerPacket({
      candidates: reviewableCandidates,
      reviewerId,
      seed,
    });
    const submissionTemplate: ReviewSubmission = {
      schemaVersion: 'study2-domain-review-submission-v1',
      materialVersion: generated.packet.materialVersion,
      reviewerId,
      packetSeed: seed,
      relevantExpertise: '',
      conflictOfInterestStatement: '',
      submittedAt: '',
      items: generated.packet.items.map((item) => ({
        blindId: item.blindId,
        binaryDecision: 'unresolved',
        supportLevel: 'unresolved',
        decisionBoundary: '',
        numericalGranularity: '',
        recommendation: 'revise',
        rationale: '',
      })),
    };
    const packetFile = `${reviewerId}.packet.json`;
    const submissionTemplateFile = `${reviewerId}.submission-template.json`;
    const crosswalkFile = `${reviewerId}.crosswalk.json`;
    const packetSerialized = serialize(generated.packet);
    const submissionSerialized = serialize(submissionTemplate);
    const crosswalkSerialized = serialize({
      roundId,
      materialVersion: generated.packet.materialVersion,
      reviewerId,
      packetSeed: seed,
      crosswalk: generated.crosswalk,
    });
    await writeFile(path.join(publicDirectory, packetFile), packetSerialized, 'utf8');
    await writeFile(
      path.join(publicDirectory, submissionTemplateFile),
      submissionSerialized,
      'utf8',
    );
    await writeFile(path.join(privateDirectory, crosswalkFile), crosswalkSerialized, 'utf8');
    manifestEntries.push({
      reviewerId,
      packetFile,
      submissionTemplateFile,
      packetSha256: sha256(packetSerialized),
      submissionTemplateSha256: sha256(submissionSerialized),
      privateCrosswalkSha256: sha256(crosswalkSerialized),
    });
  }

  const manifest = {
    roundId,
    materialVersion: reviewableCandidates[0].materialVersion,
    packetSchemaVersion: 'study2-domain-review-packet-v1',
    submissionSchemaVersion: 'study2-domain-review-submission-v1',
    packetSeed: seed,
    generatedAt: '2026-08-02T00:00:00Z',
    candidateCount: reviewableCandidates.length,
    publicSafe: true,
    crosswalkLocation: 'study2/private-review-artifacts/review-round-v1 (gitignored)',
    entries: manifestEntries,
  };
  await writeFile(
    path.join(publicDirectory, 'manifest.json'),
    serialize(manifest),
    'utf8',
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
