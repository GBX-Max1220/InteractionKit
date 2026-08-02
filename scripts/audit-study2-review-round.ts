import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildAdjudicationQueue } from '../src/study2/adjudication';
import type { ReviewerCrosswalkItem, ReviewerPacket } from '../src/study2/review-packets';
import {
  auditIndependentReviewPair,
  type ReviewSubmission,
} from '../src/study2/review-submissions';
import {
  validateReviewerRoster,
  type ReviewerRoster,
} from '../src/study2/reviewer-roster';

type ManifestEntry = {
  reviewerId: string;
  panelId: string;
  requiredDomains: string[];
  itemCount: number;
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
  reviewerRosterSchemaVersion: string;
  reviewerRosterTemplateFile: string;
  reviewerRosterTemplateSha256: string;
  entries: ManifestEntry[];
};

type CrosswalkArtifact = {
  roundId: string;
  materialVersion: string;
  reviewerId: string;
  packetSeed: string;
  crosswalk: ReviewerCrosswalkItem[];
};

type StoredPairAudit = {
  schemaVersion: 'study2-domain-review-pair-audit-v1';
  roundId: string;
  materialVersion: string;
  valid: boolean;
  counts: { reviewed: number; fullAgreement: number; adjudicationRequired: number };
  items: Array<{ candidateId: string }>;
};

const publicDirectory = path.resolve('study2', 'review-round-v2');
const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');

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
  if (packetArtifact.parsed.items.length !== entry.itemCount) {
    throw new Error(`Packet item-count mismatch for ${submission.reviewerId}.`);
  }
  if (
    packetArtifact.parsed.items.some(
      (item) => !entry.requiredDomains.includes(item.domain),
    )
  ) {
    throw new Error(`Packet domain assignment mismatch for ${submission.reviewerId}.`);
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
  const completedRosterPath = path.join(privateDirectory, 'reviewer-roster.completed.json');
  let completedRoster: ReviewerRoster;
  try {
    completedRoster = (await readJson<ReviewerRoster>(completedRosterPath)).parsed;
  } catch {
    throw new Error(
      `A completed private reviewer roster is required at ${completedRosterPath}.`,
    );
  }
  const rosterValidation = validateReviewerRoster(completedRoster, {
    roundId: manifest.roundId,
    assignments: manifest.entries.map((entry) => ({
      reviewerId: entry.reviewerId,
      panelId: entry.panelId,
      requiredDomains: entry.requiredDomains as ReviewerRoster['entries'][number]['qualifiedDomains'],
    })),
  });
  if (!rosterValidation.valid) {
    throw new Error(`Reviewer roster is invalid:\n${rosterValidation.errors.join('\n')}`);
  }
  const firstSubmission = (await readJson<ReviewSubmission>(firstPath)).parsed;
  const secondSubmission = (await readJson<ReviewSubmission>(secondPath)).parsed;
  const firstAssignment = await loadAssignment(manifest, firstSubmission);
  const secondAssignment = await loadAssignment(manifest, secondSubmission);
  const firstEntry = entryForReviewer(manifest, firstSubmission.reviewerId);
  const secondEntry = entryForReviewer(manifest, secondSubmission.reviewerId);
  if (firstEntry.panelId !== secondEntry.panelId) {
    throw new Error('Review submissions must belong to the same expertise panel.');
  }
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
  const outputPath = path.join(privateDirectory, `${firstEntry.panelId}.pair-audit.json`);
  await writeFile(outputPath, `${JSON.stringify(auditArtifact, null, 2)}\n`, 'utf8');

  if (!audit.valid) {
    throw new Error(`Review pair is invalid; private diagnostic written to ${outputPath}.`);
  }
  const adjudicationQueue = buildAdjudicationQueue({
    audit,
    roundId: manifest.roundId,
    materialVersion: manifest.materialVersion,
    panelId: firstEntry.panelId,
    generatedAt: auditArtifact.auditedAt,
  });
  const adjudicationQueuePath = path.join(
    privateDirectory,
    `${firstEntry.panelId}.adjudication-queue.json`,
  );
  await writeFile(
    adjudicationQueuePath,
    `${JSON.stringify(adjudicationQueue, null, 2)}\n`,
    'utf8',
  );

  const expectedPanels = [...new Set(manifest.entries.map((entry) => entry.panelId))].sort();
  const completedAudits: StoredPairAudit[] = [];
  const completedPanels: string[] = [];
  for (const panelId of expectedPanels) {
    try {
      const stored = (
        await readJson<StoredPairAudit>(path.join(privateDirectory, `${panelId}.pair-audit.json`))
      ).parsed;
      if (
        stored.schemaVersion === 'study2-domain-review-pair-audit-v1' &&
        stored.roundId === manifest.roundId &&
        stored.materialVersion === manifest.materialVersion &&
        stored.valid
      ) {
        completedAudits.push(stored);
        completedPanels.push(panelId);
      }
    } catch {
      // A missing or unreadable panel audit remains incomplete; it is not synthesized.
    }
  }
  const candidateCoverage = new Map<string, number>();
  for (const stored of completedAudits) {
    for (const item of stored.items) {
      candidateCoverage.set(item.candidateId, (candidateCoverage.get(item.candidateId) ?? 0) + 1);
    }
  }
  const allPanelsComplete = completedPanels.length === expectedPanels.length;
  const coverageValid =
    allPanelsComplete &&
    candidateCoverage.size === manifest.candidateCount &&
    [...candidateCoverage.values()].every((count) => count === 1);
  if (allPanelsComplete && !coverageValid) {
    throw new Error('All panel audits exist, but round-level candidate coverage is invalid.');
  }
  const roundSummaryPath = path.join(privateDirectory, 'round-audit-summary.json');
  await writeFile(
    roundSummaryPath,
    `${JSON.stringify(
      {
        schemaVersion: 'study2-domain-review-round-audit-v1',
        roundId: manifest.roundId,
        materialVersion: manifest.materialVersion,
        auditedAt: new Date().toISOString(),
        expectedPanels,
        completedPanels,
        allPanelsComplete,
        candidateCoverageValid: coverageValid,
        counts: {
          reviewed: completedAudits.reduce((sum, stored) => sum + stored.counts.reviewed, 0),
          fullAgreement: completedAudits.reduce(
            (sum, stored) => sum + stored.counts.fullAgreement,
            0,
          ),
          adjudicationRequired: completedAudits.reduce(
            (sum, stored) => sum + stored.counts.adjudicationRequired,
            0,
          ),
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(
    JSON.stringify(
      {
        valid: true,
        reviewed: audit.counts.reviewed,
        fullAgreement: audit.counts.fullAgreement,
        adjudicationRequired: audit.counts.adjudicationRequired,
        privateAudit: outputPath,
        privateAdjudicationQueue: adjudicationQueuePath,
        completedPanels,
        allPanelsComplete,
        roundCoverageValid: coverageValid,
        privateRoundSummary: roundSummaryPath,
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
