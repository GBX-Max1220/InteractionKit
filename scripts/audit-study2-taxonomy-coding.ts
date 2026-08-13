import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Study2DeliveryMaterials } from '../src/study2/delivery-materials';
import {
  auditTaxonomyCodingPair,
  type TaxonomyCoderRoster,
  type TaxonomyCodingCrosswalkItem,
  type TaxonomyCodingPacket,
  type TaxonomyCodingSubmission,
} from '../src/study2/taxonomy-coding';

type TaxonomyManifest = {
  schemaVersion: 'study2-taxonomy-coding-manifest-v1';
  roundId: 'study2-taxonomy-coding-round-v1';
  sourceBundleFile: string;
  sourceBundleSha256: string;
  sourceFrozenMaterialsSha256: string;
  answerVariantVersion: string;
  packetSeed: string;
  coderIds: string[];
  expectedJudgmentsPerCoder: number;
  files: { file: string; sha256: string }[];
};

const outputDirectory = path.resolve(
  'study2',
  'private-review-artifacts',
  'review-round-v2',
  'taxonomy-coding-v1',
);

function requiredPath(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return path.resolve(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readJson<T>(filePath: string): Promise<{ value: T; serialized: string }> {
  const serialized = await readFile(filePath, 'utf8');
  return { value: JSON.parse(serialized) as T, serialized };
}

async function main(): Promise<void> {
  const bundlePath = requiredPath('--bundle');
  const firstSubmissionPath = requiredPath('--first-submission');
  const secondSubmissionPath = requiredPath('--second-submission');
  const rosterPath = requiredPath('--coder-roster');
  const manifestArtifact = await readJson<TaxonomyManifest>(path.join(outputDirectory, 'manifest.json'));
  const manifest = manifestArtifact.value;
  if (
    manifest.schemaVersion !== 'study2-taxonomy-coding-manifest-v1' ||
    manifest.roundId !== 'study2-taxonomy-coding-round-v1' ||
    manifest.coderIds.length !== 2 ||
    new Set(manifest.coderIds).size !== 2 ||
    manifest.expectedJudgmentsPerCoder !== 96 ||
    !Array.isArray(manifest.files)
  ) throw new Error('Taxonomy coding manifest is invalid.');
  for (const entry of manifest.files) {
    const resolved = path.resolve(outputDirectory, entry.file);
    if (!resolved.startsWith(`${outputDirectory}${path.sep}`)) throw new Error('Taxonomy manifest contains an unsafe file path.');
    const content = await readFile(resolved, 'utf8');
    if (sha256(content) !== entry.sha256) throw new Error(`Taxonomy source artifact hash mismatch: ${entry.file}.`);
  }
  const bundleArtifact = await readJson<Study2DeliveryMaterials>(bundlePath);
  if (
    sha256(bundleArtifact.serialized) !== manifest.sourceBundleSha256 ||
    path.basename(bundlePath) !== manifest.sourceBundleFile ||
    bundleArtifact.value.answerVariantVersion !== manifest.answerVariantVersion ||
    bundleArtifact.value.sourceFrozenMaterialsSha256 !== manifest.sourceFrozenMaterialsSha256
  ) throw new Error('Delivery bundle does not match the frozen taxonomy-coding manifest.');

  const [firstCoderId, secondCoderId] = manifest.coderIds;
  const firstPacket = await readJson<TaxonomyCodingPacket>(path.join(outputDirectory, 'coder-distribution', `${firstCoderId}.packet.json`));
  const secondPacket = await readJson<TaxonomyCodingPacket>(path.join(outputDirectory, 'coder-distribution', `${secondCoderId}.packet.json`));
  const firstCrosswalk = await readJson<TaxonomyCodingCrosswalkItem[]>(path.join(outputDirectory, 'coordinator-only', `${firstCoderId}.crosswalk.json`));
  const secondCrosswalk = await readJson<TaxonomyCodingCrosswalkItem[]>(path.join(outputDirectory, 'coordinator-only', `${secondCoderId}.crosswalk.json`));
  const firstSubmission = await readJson<TaxonomyCodingSubmission>(firstSubmissionPath);
  const secondSubmission = await readJson<TaxonomyCodingSubmission>(secondSubmissionPath);
  const roster = await readJson<TaxonomyCoderRoster>(rosterPath);
  const audit = auditTaxonomyCodingPair({
    bundle: bundleArtifact.value,
    firstPacket: firstPacket.value,
    firstCrosswalk: firstCrosswalk.value,
    firstSubmission: firstSubmission.value,
    secondPacket: secondPacket.value,
    secondCrosswalk: secondCrosswalk.value,
    secondSubmission: secondSubmission.value,
    coderRoster: roster.value,
  });
  if (!audit.valid) throw new Error(`Taxonomy coding artifacts are invalid:\n${audit.errors.join('\n')}`);

  const auditedAt = new Date().toISOString();
  const auditArtifact = {
    schemaVersion: 'study2-taxonomy-coding-pair-audit-v1',
    roundId: manifest.roundId,
    sourceManifestSha256: sha256(manifestArtifact.serialized),
    sourceBundleSha256: manifest.sourceBundleSha256,
    sourceSubmissionSha256: {
      [firstCoderId]: sha256(firstSubmission.serialized),
      [secondCoderId]: sha256(secondSubmission.serialized),
    },
    sourceCoderRosterSha256: sha256(roster.serialized),
    auditedAt,
    ...audit,
  };
  const disputeQueue = {
    schemaVersion: 'study2-taxonomy-dispute-queue-v1',
    roundId: manifest.roundId,
    sourceAuditSha256: sha256(`${JSON.stringify(auditArtifact, null, 2)}\n`),
    generatedAt: auditedAt,
    items: audit.items.filter((item) => item.disposition === 'remove_or_third_coder_review'),
  };
  await writeFile(
    path.join(outputDirectory, 'coordinator-only', 'taxonomy-coding.pair-audit.json'),
    `${JSON.stringify(auditArtifact, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(outputDirectory, 'coordinator-only', 'taxonomy-coding.dispute-queue.json'),
    `${JSON.stringify(disputeQueue, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify({
    valid: true,
    rawAgreement: audit.rawAgreement,
    cohensKappa: audit.cohensKappa,
    passesAggregateThresholds: audit.passesAggregateThresholds,
    allVariantsRetained: audit.allVariantsRetained,
    disputed: audit.counts.disputed,
  }, null, 2));
  if (!audit.passesAggregateThresholds || !audit.allVariantsRetained) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
