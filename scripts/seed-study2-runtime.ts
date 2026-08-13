import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { study2RuntimeRepository } from '../lib/study2-runtime-postgres';
import type { Study2DeliveryMaterials } from '../src/study2/delivery-materials';
import type { FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';
import {
  prepareStudy2RuntimeSeeds,
  type Study2RuntimeDeploymentGate,
} from '../src/study2/runtime-seeding';
import type { Study2Allocation } from '../src/study2/types';

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return path.resolve(value);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function main(): Promise<void> {
  const outputFile = requiredArgument('--output');
  if (!outputFile.endsWith('.study2-access-manifest.json')) {
    throw new Error('Private access manifest filename must end in .study2-access-manifest.json.');
  }
  try {
    await access(outputFile);
    throw new Error('Private access manifest output already exists; refusing to overwrite it.');
  } catch (error) {
    if (error instanceof Error && !('code' in error)) throw error;
    if (typeof error === 'object' && error !== null && 'code' in error && error.code !== 'ENOENT') throw error;
  }
  const temporaryOutput = `${outputFile}.pending`;
  const [allocation, bundle, frozen, gate, taxonomyFinalization, cardSafetyFinalization, presentationAudit] = await Promise.all([
    readJson<Study2Allocation>(requiredArgument('--allocation')),
    readJson<Study2DeliveryMaterials>(requiredArgument('--bundle')),
    readJson<FrozenStudy2MaterialsArtifact>(requiredArgument('--frozen')),
    readJson<Study2RuntimeDeploymentGate>(requiredArgument('--gate')),
    readJson<unknown>(requiredArgument('--taxonomy-finalization')),
    readJson<unknown>(requiredArgument('--card-safety-finalization')),
    readJson<unknown>(requiredArgument('--presentation-audit')),
  ]);
  const seeds = await prepareStudy2RuntimeSeeds({
    allocation,
    bundle,
    frozen,
    gate,
    taxonomyFinalization,
    cardSafetyFinalization,
    presentationAudit,
  });
  const accessManifest = {
    schemaVersion: 'study2-private-access-manifest-v1',
    generatedAt: new Date().toISOString(),
    allocationSha256: gate.allocationSha256,
    participants: seeds.map(({ participantIndex, accessToken, accessUrl }) => ({
      participantIndex,
      accessToken,
      accessUrl,
    })),
  };
  await writeFile(temporaryOutput, `${JSON.stringify(accessManifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  try {
    await study2RuntimeRepository().createMany(
      seeds.map(({ accessToken, state }) => ({ accessToken, state })),
    );
    await rename(temporaryOutput, outputFile);
  } catch (error) {
    await rm(temporaryOutput, { force: true });
    throw error;
  }
  console.log(JSON.stringify({
    seededSessions: seeds.length,
    privateAccessManifest: outputFile,
    accessTokensPrinted: false,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
