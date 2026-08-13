import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  generateCardSafetyPacket,
  renderCardSafetyReviewForm,
  type CardSafetyReviewerRoster,
} from '../src/study2/card-safety-review';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { auditDeliveryMaterials, type Study2DeliveryMaterials } from '../src/study2/delivery-materials';
import { STUDY2_EVIDENCE_DOSSIERS } from '../src/study2/evidence-dossiers';
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
const outputDirectory = path.join(privateDirectory, 'card-safety-review-v1');

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
  if (/tbd|todo|placeholder|\[(?:set|insert)/i.test(seed)) throw new Error('Card-safety packet seed must be a final identifier.');
  const authoringManifestSerialized = await readFile(path.join(authoringDirectory, 'manifest.json'), 'utf8');
  const authoringManifest = JSON.parse(authoringManifestSerialized) as AuthoringManifest;
  if (
    authoringManifest.schemaVersion !== 'study2-delivery-authoring-manifest-v1' ||
    path.basename(authoringManifest.sourceFrozenMaterialsFile) !== authoringManifest.sourceFrozenMaterialsFile
  ) throw new Error('Delivery-authoring manifest is invalid.');
  const frozenSerialized = await readFile(path.join(privateDirectory, authoringManifest.sourceFrozenMaterialsFile), 'utf8');
  if (sha256(frozenSerialized) !== authoringManifest.sourceFrozenMaterialsSha256) throw new Error('Frozen materials no longer match the authoring manifest.');
  const bundleSerialized = await readFile(bundlePath, 'utf8');
  const frozen = JSON.parse(frozenSerialized) as FrozenStudy2MaterialsArtifact;
  const bundle = JSON.parse(bundleSerialized) as Study2DeliveryMaterials;
  const deliveryAudit = auditDeliveryMaterials({
    bundle,
    frozen,
    candidates: STUDY2_CANDIDATES,
    expectedFrozenMaterialsSha256: authoringManifest.sourceFrozenMaterialsSha256,
    expectedAnswerVariantVersion: authoringManifest.answerVariantVersion,
    expectedInterventionCardVersion: authoringManifest.interventionCardVersion,
  });
  if (!deliveryAudit.structurallyValid) throw new Error(`Cannot prepare card-safety review from invalid delivery materials:\n${deliveryAudit.errors.join('\n')}`);

  const reviewerIds = ['card-reviewer-a', 'card-reviewer-b'] as const;
  const generated = reviewerIds.map((reviewerId) => ({
    reviewerId,
    ...generateCardSafetyPacket({ bundle, frozen, dossiers: STUDY2_EVIDENCE_DOSSIERS, reviewerId, seed }),
  }));
  const rosterTemplate: CardSafetyReviewerRoster = {
    schemaVersion: 'study2-card-safety-reviewer-roster-v1',
    roundId: 'study2-card-safety-round-v1',
    entries: reviewerIds.map((reviewerId) => ({
      reviewerId,
      stablePersonId: '',
      trainingExampleVersion: 'study2-card-safety-training-v1',
      trainingCompleted: false,
      materialContributionConflict: true,
      hypothesisBlindAttestation: false,
      eligibilityDecision: 'ineligible',
      verifiedBy: '',
      verifiedAt: '',
    })),
  };
  const files = generated.flatMap((entry) => [
    { path: path.join('reviewer-distribution', `${entry.reviewerId}.packet.json`), content: serialized(entry.packet) },
    { path: path.join('reviewer-distribution', `${entry.reviewerId}.form.md`), content: `${renderCardSafetyReviewForm(entry.packet)}\n` },
    { path: path.join('reviewer-distribution', `${entry.reviewerId}.submission.template.json`), content: serialized(entry.submissionTemplate) },
    { path: path.join('coordinator-only', `${entry.reviewerId}.crosswalk.json`), content: serialized(entry.crosswalk) },
  ]);
  files.push({ path: path.join('coordinator-only', 'reviewer-roster.template.json'), content: serialized(rosterTemplate) });
  const dossierSnapshot = serialized(STUDY2_EVIDENCE_DOSSIERS);
  const outputManifest = {
    schemaVersion: 'study2-card-safety-manifest-v1',
    roundId: 'study2-card-safety-round-v1',
    sourceBundleFile: path.basename(bundlePath),
    sourceBundleSha256: sha256(bundleSerialized),
    sourceFrozenMaterialsSha256: authoringManifest.sourceFrozenMaterialsSha256,
    sourceAuthoringManifestSha256: sha256(authoringManifestSerialized),
    sourceEvidenceDossiersSha256: sha256(dossierSnapshot),
    answerVariantVersion: bundle.answerVariantVersion,
    interventionCardVersion: bundle.interventionCardVersion,
    packetSeed: seed,
    reviewerIds,
    expectedCardsPerReviewer: 192,
    files: files.map((file) => ({ file: file.path.replaceAll('\\', '/'), sha256: sha256(file.content) })),
    failSafeTemplates: true,
    generatedAt: new Date().toISOString(),
  };
  await mkdir(path.join(outputDirectory, 'reviewer-distribution'), { recursive: true });
  await mkdir(path.join(outputDirectory, 'coordinator-only'), { recursive: true });
  await Promise.all(files.map((file) => writeFile(path.join(outputDirectory, file.path), file.content, 'utf8')));
  await writeFile(path.join(outputDirectory, 'manifest.json'), serialized(outputManifest), 'utf8');
  console.log(JSON.stringify({ valid: true, reviewerPackets: 2, cardsPerReviewer: 192, privateDirectory: outputDirectory }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
