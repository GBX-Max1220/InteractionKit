import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildDeliveryAuthoringTemplate } from '../src/study2/delivery-materials';
import type { FrozenStudy2MaterialsArtifact } from '../src/study2/frozen-materials';

const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return value.trim();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main(): Promise<void> {
  const answerVariantVersion = requiredArgument('--answer-version');
  const interventionCardVersion = requiredArgument('--card-version');
  if (/tbd|todo|placeholder|\[(?:set|insert)/i.test(`${answerVariantVersion} ${interventionCardVersion}`)) {
    throw new Error('Answer and card versions must be final identifiers, not placeholders.');
  }
  const frozenPath = path.join(privateDirectory, 'frozen-materials-v1.json');
  const frozenSerialized = await readFile(frozenPath, 'utf8');
  const frozen = JSON.parse(frozenSerialized) as FrozenStudy2MaterialsArtifact;
  if (
    frozen.schemaVersion !== 'study2-frozen-materials-v1' ||
    !Array.isArray(frozen.items) ||
    frozen.items.length !== 24
  ) {
    throw new Error('A valid 24-item frozen-material artifact is required before delivery authoring.');
  }
  const sourceFrozenMaterialsSha256 = sha256(frozenSerialized);
  const template = buildDeliveryAuthoringTemplate({
    frozen,
    answerVariantVersion,
    interventionCardVersion,
    sourceFrozenMaterialsSha256,
  });
  const authoringDirectory = path.join(privateDirectory, 'delivery-authoring-v1');
  await mkdir(authoringDirectory, { recursive: true });
  const templateFile = 'delivery-materials.template.json';
  const templateSerialized = `${JSON.stringify(template, null, 2)}\n`;
  await writeFile(path.join(authoringDirectory, templateFile), templateSerialized, 'utf8');
  await writeFile(
    path.join(authoringDirectory, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 'study2-delivery-authoring-manifest-v1',
        roundId: frozen.roundId,
        frozenMaterialVersion: frozen.materialVersion,
        sourceFrozenMaterialsFile: path.basename(frozenPath),
        sourceFrozenMaterialsSha256,
        answerVariantVersion,
        interventionCardVersion,
        expectedAnswerVariants: 96,
        expectedInterventionCards: 192,
        templateFile,
        templateSha256: sha256(templateSerialized),
        templateIsDeliberatelyIncomplete: true,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(JSON.stringify({
    valid: true,
    answerVariants: template.variants.length,
    interventionCards: template.variants.reduce((sum, variant) => sum + variant.cards.length, 0),
    privateDirectory: authoringDirectory,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
