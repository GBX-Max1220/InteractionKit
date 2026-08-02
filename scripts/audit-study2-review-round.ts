import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ReviewerCrosswalkItem, ReviewerPacket } from '../src/study2/review-packets';
import {
  auditIndependentReviewPair,
  type ReviewSubmission,
} from '../src/study2/review-submissions';

type ManifestEntry = {
  reviewerId: string;
  packetFile: string;
  submissionTemplateFile: string;
  packetSha256: string;
  submissionTemplateSha256: string;
  privateCrosswalkSha256: string;
};

type Manifest = {
  roundId: string;
  materialVersion: string;
  candidateCount: number;
  entries: ManifestEntry[];
};

type CrosswalkArtifact = {
  roundId: string;
  materialVersion: string;
  reviewerId: string;
  packetSeed: string;
  crosswalk: ReviewerCrosswalkItem[];
};

const publicDirectory = path.resolve('study2', 'review-round-v1');
const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v1');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readJson<T>(file: string): Promise<{ parsed: T; serialized: string }> {
  const serialized = await readFile(file, 'utf8');
  return { parsed: JSON.parse(serialized) as T, serialized };
}

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing required argument ${name} <submission.json>.`);
  }
  return path.resolve(value);
}

function entryForReviewer(manifest: Manifest, reviewerId: string): ManifestEntry {
  const entry = manifest.entries.find((candidate) => candidate.reviewerId === reviewerId);
  if (!entry) throw new Error(`No round assignment exists for reviewer ${reviewerId}.`);
  return entry;
}

async function loadAssignment(
  manifest: Manifest,
  submission: ReviewSubmission,
): Promise<{ packet: ReviewerPacket; crosswalk: ReviewerCrosswalkItem[] }> {
  const entry = entryForReviewer(manifest, submission.reviewerId);
  const packetArtifact = await readJson<ReviewerPacket>(
    path.join(publicDirectory, entry.packetFile),
  );
  if (sha256(packetArtifact.serialized) !== entry.packetSha256) {
    throw new Error(`Packet hash mismatch for ${submission.reviewerId}.`);
  }

  const crosswalkFile = path.join(privateDirectory, `${submission.reviewerId}.crosswalk.json`);
  const crosswalkArtifact = await readJson<CrosswalkArtifact>(crosswalkFile);
  if (sha256(crosswalkArtifact.serialized) !== entry.privateCrosswalkSha256) {
    throw new Error(`Private crosswalk hash mismatch for ${submission.reviewerId}.`);
  }
  if (
    crosswalkArtifact.parsed.roundId !== manifest.roundId ||
    crosswalkArtifact.parsed.materialVersion !== manifest.materialVersion ||
    crosswalkArtifact.parsed.reviewerId !== submission.reviewerId ||
    crosswalkArtifact.parsed.packetSeed !== packetArtifact.parsed.packetSeed
  ) {
    throw new Error(`Private crosswalk metadata mismatch for ${submission.reviewerId}.`);
  }
  return {
    packet: packetArtifact.parsed,
    crosswalk: crosswalkArtifact.parsed.crosswalk,
  };
}

async function main(): Promise<void> {
  const firstPath = requiredArgument('--first');
  const secondPath = requiredArgument('--second');
  if (firstPath === secondPath) throw new Error('Two distinct submission files are required.');

  const manifest = (
    await readJson<Manifest>(path.join(publicDirectory, 'manifest.json'))
  ).parsed;
  const firstSubmission = (await readJson<ReviewSubmission>(firstPath)).parsed;
  const secondSubmission = (await readJson<ReviewSubmission>(secondPath)).parsed;
  const firstAssignment = await loadAssignment(manifest, firstSubmission);
  const secondAssignment = await loadAssignment(manifest, secondSubmission);
  const audit = auditIndependentReviewPair({
    firstSubmission,
    firstPacket: firstAssignment.packet,
    firstCrosswalk: firstAssignment.crosswalk,
    secondSubmission,
    secondPacket: secondAssignment.packet,
    secondCrosswalk: secondAssignment.crosswalk,
  });

  const auditArtifact = {
    schemaVersion: 'study2-domain-review-pair-audit-v1',
    roundId: manifest.roundId,
    materialVersion: manifest.materialVersion,
    auditedAt: new Date().toISOString(),
    sourceSubmissionFiles: [path.basename(firstPath), path.basename(secondPath)],
    ...audit,
  };
  await mkdir(privateDirectory, { recursive: true });
  const outputPath = path.join(privateDirectory, 'pair-audit.json');
  await writeFile(outputPath, `${JSON.stringify(auditArtifact, null, 2)}\n`, 'utf8');

  if (!audit.valid) {
    throw new Error(`Review pair is invalid; private diagnostic written to ${outputPath}.`);
  }
  console.log(
    JSON.stringify(
      {
        valid: true,
        reviewed: audit.counts.reviewed,
        fullAgreement: audit.counts.fullAgreement,
        adjudicationRequired: audit.counts.adjudicationRequired,
        privateAudit: outputPath,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
