import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import {
  auditDeliveryMaterials,
  type Study2DeliveryMaterials,
} from '../src/study2/delivery-materials';
import type { FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';

type AuthoringManifest = {
  schemaVersion: 'study2-delivery-authoring-manifest-v1';
  sourceFrozenMaterialsFile: string;
  sourceFrozenMaterialsSha256: string;
  answerVariantVersion: string;
  interventionCardVersion: string;
};

const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');
const authoringDirectory = path.join(privateDirectory, 'delivery-authoring-v1');

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return path.resolve(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main(): Promise<void> {
  const bundlePath = requiredArgument('--bundle');
  const manifest = JSON.parse(
    await readFile(path.join(authoringDirectory, 'manifest.json'), 'utf8'),
  ) as AuthoringManifest;
  if (
    manifest.schemaVersion !== 'study2-delivery-authoring-manifest-v1' ||
    path.basename(manifest.sourceFrozenMaterialsFile) !== manifest.sourceFrozenMaterialsFile
  ) {
    throw new Error('Delivery-authoring manifest is invalid.');
  }
  const frozenSerialized = await readFile(
    path.join(privateDirectory, manifest.sourceFrozenMaterialsFile),
    'utf8',
  );
  if (sha256(frozenSerialized) !== manifest.sourceFrozenMaterialsSha256) {
    throw new Error('Frozen-material artifact no longer matches the authoring manifest.');
  }
  const frozen = JSON.parse(frozenSerialized) as FrozenStudy2MaterialsArtifact;
  const bundleSerialized = await readFile(bundlePath, 'utf8');
  const bundle = JSON.parse(bundleSerialized) as Study2DeliveryMaterials;
  const audit = auditDeliveryMaterials({
    bundle,
    frozen,
    candidates: STUDY2_CANDIDATES,
    expectedFrozenMaterialsSha256: manifest.sourceFrozenMaterialsSha256,
    expectedAnswerVariantVersion: manifest.answerVariantVersion,
    expectedInterventionCardVersion: manifest.interventionCardVersion,
  });
  const outputPath = path.join(authoringDirectory, 'delivery-materials.structural-audit.json');
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 'study2-delivery-material-structural-audit-v1',
        bundleFile: path.basename(bundlePath),
        bundleSha256: sha256(bundleSerialized),
        sourceFrozenMaterialsSha256: manifest.sourceFrozenMaterialsSha256,
        auditedAt: new Date().toISOString(),
        ...audit,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  if (!audit.structurallyValid) {
    throw new Error(`Delivery materials are structurally invalid:\n${audit.errors.join('\n')}`);
  }
  console.log(
    JSON.stringify(
      {
        structurallyValid: true,
        pilotReady: false,
        counts: audit.counts,
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
