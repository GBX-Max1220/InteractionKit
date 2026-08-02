import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import {
  auditDeliveryMaterials,
  type Study2DeliveryMaterials,
} from '../src/study2/delivery-materials';
import type { FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';
import {
  generateTaxonomyCodingPacket,
  renderTaxonomyCodingForm,
  type TaxonomyCoderRoster,
} from '../src/study2/taxonomy-coding';

type AuthoringManifest = {
  schemaVersion: 'study2-delivery-authoring-manifest-v1';
  sourceFrozenMaterialsFile: string;
  sourceFrozenMaterialsSha256: string;
  answerVariantVersion: string;
  interventionCardVersion: string;
};

const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');
const authoringDirectory = path.join(privateDirectory, 'delivery-authoring-v1');
const outputDirectory = path.join(privateDirectory, 'taxonomy-coding-v1');

function requiredArgument(name: string, resolvePath = false): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return resolvePath ? path.resolve(value) : value.trim();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function serialized(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main(): Promise<void> {
  const bundlePath = requiredArgument('--bundle', true);
  const seed = requiredArgument('--seed');
  if (/tbd|todo|placeholder|\[(?:set|insert)/i.test(seed)) {
    throw new Error('Taxonomy packet seed must be a final identifier, not a placeholder.');
  }
  const manifestSerialized = await readFile(path.join(authoringDirectory, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestSerialized) as AuthoringManifest;
  if (
    manifest.schemaVersion !== 'study2-delivery-authoring-manifest-v1' ||
    path.basename(manifest.sourceFrozenMaterialsFile) !== manifest.sourceFrozenMaterialsFile
  ) throw new Error('Delivery-authoring manifest is invalid.');
  const frozenSerialized = await readFile(path.join(privateDirectory, manifest.sourceFrozenMaterialsFile), 'utf8');
  if (sha256(frozenSerialized) !== manifest.sourceFrozenMaterialsSha256) {
    throw new Error('Frozen-material artifact no longer matches the delivery-authoring manifest.');
  }
  const bundleSerialized = await readFile(bundlePath, 'utf8');
  const frozen = JSON.parse(frozenSerialized) as FrozenStudy2MaterialsArtifact;
  const bundle = JSON.parse(bundleSerialized) as Study2DeliveryMaterials;
  const deliveryAudit = auditDeliveryMaterials({
    bundle,
    frozen,
    candidates: STUDY2_CANDIDATES,
    expectedFrozenMaterialsSha256: manifest.sourceFrozenMaterialsSha256,
    expectedAnswerVariantVersion: manifest.answerVariantVersion,
    expectedInterventionCardVersion: manifest.interventionCardVersion,
  });
  if (!deliveryAudit.structurallyValid) {
    throw new Error(`Cannot prepare taxonomy coding from invalid delivery materials:\n${deliveryAudit.errors.join('\n')}`);
  }

  const coders = ['taxonomy-coder-a', 'taxonomy-coder-b'] as const;
  const generated = coders.map((coderId) => ({
    coderId,
    ...generateTaxonomyCodingPacket({ bundle, frozen, coderId, seed }),
  }));
  const rosterTemplate: TaxonomyCoderRoster = {
    schemaVersion: 'study2-taxonomy-coder-roster-v1',
    roundId: 'study2-taxonomy-coding-round-v1',
    entries: coders.map((coderId) => ({
      coderId,
      stablePersonId: '',
      trainingExampleVersion: 'study2-taxonomy-training-v1',
      trainingCompleted: false,
      materialContributionConflict: true,
      hypothesisBlindAttestation: false,
      eligibilityDecision: 'ineligible',
      verifiedBy: '',
      verifiedAt: '',
    })),
  };
  const files = generated.flatMap((entry) => {
    const packet = serialized(entry.packet);
    const form = `${renderTaxonomyCodingForm(entry.packet)}\n`;
    const submission = serialized(entry.submissionTemplate);
    const crosswalk = serialized(entry.crosswalk);
    return [
      { path: path.join('coder-distribution', `${entry.coderId}.packet.json`), content: packet },
      { path: path.join('coder-distribution', `${entry.coderId}.form.md`), content: form },
      { path: path.join('coder-distribution', `${entry.coderId}.submission.template.json`), content: submission },
      { path: path.join('coordinator-only', `${entry.coderId}.crosswalk.json`), content: crosswalk },
    ];
  });
  files.push({ path: path.join('coordinator-only', 'coder-roster.template.json'), content: serialized(rosterTemplate) });
  const outputManifest = {
    schemaVersion: 'study2-taxonomy-coding-manifest-v1',
    roundId: 'study2-taxonomy-coding-round-v1',
    sourceBundleFile: path.basename(bundlePath),
    sourceBundleSha256: sha256(bundleSerialized),
    sourceFrozenMaterialsSha256: manifest.sourceFrozenMaterialsSha256,
    sourceAuthoringManifestSha256: sha256(manifestSerialized),
    answerVariantVersion: bundle.answerVariantVersion,
    packetSeed: seed,
    coderIds: coders,
    expectedJudgmentsPerCoder: 96,
    files: files.map((file) => ({ file: file.path.replaceAll('\\', '/'), sha256: sha256(file.content) })),
    failSafeTemplates: true,
    generatedAt: new Date().toISOString(),
  };

  await mkdir(path.join(outputDirectory, 'coder-distribution'), { recursive: true });
  await mkdir(path.join(outputDirectory, 'coordinator-only'), { recursive: true });
  await Promise.all(files.map((file) => writeFile(path.join(outputDirectory, file.path), file.content, 'utf8')));
  await writeFile(path.join(outputDirectory, 'manifest.json'), serialized(outputManifest), 'utf8');
  console.log(JSON.stringify({
    valid: true,
    coderPackets: generated.length,
    judgmentsPerCoder: 96,
    privateDirectory: outputDirectory,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
