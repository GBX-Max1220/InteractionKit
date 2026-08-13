import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  auditCardSafetyPair,
  type CardSafetyCrosswalkItem,
  type CardSafetyPacket,
  type CardSafetyReviewerRoster,
  type CardSafetySubmission,
} from '../src/study2/card-safety-review';
import type { Study2DeliveryMaterials } from '../src/study2/delivery-materials';
import { STUDY2_EVIDENCE_DOSSIERS } from '../src/study2/evidence-dossiers';

type CardSafetyManifest = {
  schemaVersion: 'study2-card-safety-manifest-v1';
  roundId: 'study2-card-safety-round-v1';
  sourceBundleFile: string;
  sourceBundleSha256: string;
  sourceFrozenMaterialsSha256: string;
  sourceEvidenceDossiersSha256: string;
  answerVariantVersion: string;
  interventionCardVersion: string;
  packetSeed: string;
  reviewerIds: string[];
  expectedCardsPerReviewer: number;
  files: { file: string; sha256: string }[];
};

const outputDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2', 'card-safety-review-v1');

function requiredPath(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return path.resolve(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function serialized(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson<T>(filePath: string): Promise<{ value: T; serialized: string }> {
  const value = await readFile(filePath, 'utf8');
  return { value: JSON.parse(value) as T, serialized: value };
}

async function main(): Promise<void> {
  const bundlePath = requiredPath('--bundle');
  const firstSubmissionPath = requiredPath('--first-submission');
  const secondSubmissionPath = requiredPath('--second-submission');
  const rosterPath = requiredPath('--reviewer-roster');
  const manifestArtifact = await readJson<CardSafetyManifest>(path.join(outputDirectory, 'manifest.json'));
  const manifest = manifestArtifact.value;
  if (
    manifest.schemaVersion !== 'study2-card-safety-manifest-v1' ||
    manifest.roundId !== 'study2-card-safety-round-v1' ||
    manifest.reviewerIds.length !== 2 ||
    new Set(manifest.reviewerIds).size !== 2 ||
    manifest.expectedCardsPerReviewer !== 192 ||
    !Array.isArray(manifest.files)
  ) throw new Error('Card-safety manifest is invalid.');
  if (sha256(serialized(STUDY2_EVIDENCE_DOSSIERS)) !== manifest.sourceEvidenceDossiersSha256) {
    throw new Error('Evidence dossiers no longer match the frozen card-safety manifest.');
  }
  for (const entry of manifest.files) {
    const resolved = path.resolve(outputDirectory, entry.file);
    if (!resolved.startsWith(`${outputDirectory}${path.sep}`)) throw new Error('Card-safety manifest contains an unsafe file path.');
    if (sha256(await readFile(resolved, 'utf8')) !== entry.sha256) throw new Error(`Card-safety source artifact hash mismatch: ${entry.file}.`);
  }
  const bundle = await readJson<Study2DeliveryMaterials>(bundlePath);
  if (
    sha256(bundle.serialized) !== manifest.sourceBundleSha256 ||
    path.basename(bundlePath) !== manifest.sourceBundleFile ||
    bundle.value.sourceFrozenMaterialsSha256 !== manifest.sourceFrozenMaterialsSha256 ||
    bundle.value.answerVariantVersion !== manifest.answerVariantVersion ||
    bundle.value.interventionCardVersion !== manifest.interventionCardVersion
  ) throw new Error('Delivery bundle does not match the frozen card-safety manifest.');

  const [firstReviewerId, secondReviewerId] = manifest.reviewerIds;
  const firstPacket = await readJson<CardSafetyPacket>(path.join(outputDirectory, 'reviewer-distribution', `${firstReviewerId}.packet.json`));
  const secondPacket = await readJson<CardSafetyPacket>(path.join(outputDirectory, 'reviewer-distribution', `${secondReviewerId}.packet.json`));
  const firstCrosswalk = await readJson<CardSafetyCrosswalkItem[]>(path.join(outputDirectory, 'coordinator-only', `${firstReviewerId}.crosswalk.json`));
  const secondCrosswalk = await readJson<CardSafetyCrosswalkItem[]>(path.join(outputDirectory, 'coordinator-only', `${secondReviewerId}.crosswalk.json`));
  const firstSubmission = await readJson<CardSafetySubmission>(firstSubmissionPath);
  const secondSubmission = await readJson<CardSafetySubmission>(secondSubmissionPath);
  const roster = await readJson<CardSafetyReviewerRoster>(rosterPath);
  const audit = auditCardSafetyPair({
    bundle: bundle.value,
    firstPacket: firstPacket.value,
    firstCrosswalk: firstCrosswalk.value,
    firstSubmission: firstSubmission.value,
    secondPacket: secondPacket.value,
    secondCrosswalk: secondCrosswalk.value,
    secondSubmission: secondSubmission.value,
    reviewerRoster: roster.value,
  });
  if (!audit.valid) throw new Error(`Card-safety artifacts are invalid:\n${audit.errors.join('\n')}`);
  const auditedAt = new Date().toISOString();
  const auditArtifact = {
    schemaVersion: 'study2-card-safety-pair-audit-v1',
    roundId: manifest.roundId,
    sourceManifestSha256: sha256(manifestArtifact.serialized),
    sourceBundleSha256: manifest.sourceBundleSha256,
    sourceSubmissionSha256: {
      [firstReviewerId]: sha256(firstSubmission.serialized),
      [secondReviewerId]: sha256(secondSubmission.serialized),
    },
    sourceReviewerRosterSha256: sha256(roster.serialized),
    auditedAt,
    ...audit,
  };
  const auditSerialized = serialized(auditArtifact);
  const revisionQueue = {
    schemaVersion: 'study2-card-safety-revision-queue-v1',
    roundId: manifest.roundId,
    sourceAuditSha256: sha256(auditSerialized),
    generatedAt: auditedAt,
    items: audit.items.filter((item) => item.disposition === 'revise_and_rereview'),
  };
  await writeFile(path.join(outputDirectory, 'coordinator-only', 'card-safety.pair-audit.json'), auditSerialized, 'utf8');
  await writeFile(path.join(outputDirectory, 'coordinator-only', 'card-safety.revision-queue.json'), serialized(revisionQueue), 'utf8');
  console.log(JSON.stringify({
    valid: true,
    rawCriterionAgreement: audit.rawCriterionAgreement,
    gwetsAc1: audit.gwetsAc1,
    passesAggregateThresholds: audit.passesAggregateThresholds,
    allCardsRetained: audit.allCardsRetained,
    disputedOrFlagged: audit.counts.disputedOrFlagged,
  }, null, 2));
  if (!audit.passesAggregateThresholds || !audit.allCardsRetained) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
