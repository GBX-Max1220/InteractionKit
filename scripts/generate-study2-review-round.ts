import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import { generateReviewerPacket } from '../src/study2/review-packets';
import { renderReviewerForm } from '../src/study2/reviewer-form';
import type { ReviewSubmission } from '../src/study2/review-submissions';

const roundId = 'study2-domain-review-round-v2';
const seed = 'study2-domain-review-v2-2026-08-02';
const publicDirectory = path.resolve('study2', 'review-round-v2');
const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');
const panels = [
  {
    panelId: 'exercise-physiology',
    reviewerIds: ['exercise-physiology-reviewer-01', 'exercise-physiology-reviewer-02'],
    domains: ['exercise_training', 'recovery', 'environment'],
  },
  {
    panelId: 'sports-nutrition',
    reviewerIds: ['sports-nutrition-reviewer-01', 'sports-nutrition-reviewer-02'],
    domains: ['nutrition'],
  },
  {
    panelId: 'sports-medicine',
    reviewerIds: ['sports-medicine-reviewer-01', 'sports-medicine-reviewer-02'],
    domains: ['injury_risk'],
  },
] as const;

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
    panelId: string;
    requiredDomains: string[];
    itemCount: number;
    packetFile: string;
    submissionTemplateFile: string;
    reviewerFormFile: string;
    packetSha256: string;
    submissionTemplateSha256: string;
    reviewerFormSha256: string;
    privateCrosswalkSha256: string;
  }> = [];
  const assignmentCoverage = new Map<string, number>();
  const reviewerIds = panels.flatMap((panel) => [...panel.reviewerIds]);
  if (new Set(reviewerIds).size !== reviewerIds.length) {
    throw new Error('Reviewer assignment IDs must be globally unique.');
  }

  for (const panel of panels) {
    const panelCandidates = reviewableCandidates.filter((candidate) =>
      (panel.domains as readonly string[]).includes(candidate.domain),
    );
    if (panelCandidates.length === 0) {
      throw new Error(`Panel ${panel.panelId} has no assigned candidates.`);
    }
    for (const reviewerId of panel.reviewerIds) {
      for (const candidate of panelCandidates) {
        assignmentCoverage.set(
          candidate.id,
          (assignmentCoverage.get(candidate.id) ?? 0) + 1,
        );
      }
      const generated = generateReviewerPacket({
        candidates: panelCandidates,
        reviewerId,
        seed,
      });
      const submissionTemplate: ReviewSubmission = {
        schemaVersion: 'study2-domain-review-submission-v2',
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
          sourceConcern: '',
          recommendation: 'revise',
          rationale: '',
        })),
      };
      const packetFile = `${reviewerId}.packet.json`;
      const submissionTemplateFile = `${reviewerId}.submission-template.json`;
      const crosswalkFile = `${reviewerId}.crosswalk.json`;
      const reviewerFormFile = `${reviewerId}.review-form.html`;
      const packetSerialized = serialize(generated.packet);
      const submissionSerialized = serialize(submissionTemplate);
      const crosswalkSerialized = serialize({
        roundId,
        materialVersion: generated.packet.materialVersion,
        reviewerId,
        packetSeed: seed,
        crosswalk: generated.crosswalk,
      });
      const reviewerFormSerialized = renderReviewerForm(generated.packet);
      await writeFile(path.join(publicDirectory, packetFile), packetSerialized, 'utf8');
      await writeFile(
        path.join(publicDirectory, submissionTemplateFile),
        submissionSerialized,
        'utf8',
      );
      await writeFile(path.join(privateDirectory, crosswalkFile), crosswalkSerialized, 'utf8');
      await writeFile(path.join(publicDirectory, reviewerFormFile), reviewerFormSerialized, 'utf8');
      manifestEntries.push({
        reviewerId,
        panelId: panel.panelId,
        requiredDomains: [...panel.domains],
        itemCount: panelCandidates.length,
        packetFile,
        submissionTemplateFile,
        reviewerFormFile,
        packetSha256: sha256(packetSerialized),
        submissionTemplateSha256: sha256(submissionSerialized),
        reviewerFormSha256: sha256(reviewerFormSerialized),
        privateCrosswalkSha256: sha256(crosswalkSerialized),
      });
    }
  }

  if (
    assignmentCoverage.size !== reviewableCandidates.length ||
    [...assignmentCoverage.values()].some((count) => count !== 2)
  ) {
    throw new Error('Every source-complete candidate must receive exactly two assignments.');
  }

  const reviewerRosterTemplateFile = 'reviewer-roster.template.json';
  const reviewerRosterTemplateSerialized = serialize({
    schemaVersion: 'study2-reviewer-roster-v1',
    roundId,
    entries: manifestEntries.map((entry) => ({
      reviewerId: entry.reviewerId,
      panelId: entry.panelId,
      stablePersonId: '',
      qualifiedDomains: entry.requiredDomains,
      relevantQualifications: '',
      identityVerificationMethod: '',
      conflictOfInterestStatement: '',
      materialContributionConflict: true,
      independenceAttestation: '',
      compensationStatement: '',
      outcomeContingentCompensation: true,
      eligibilityDecision: 'ineligible',
      verifiedBy: '',
      verifiedAt: '',
    })),
  });
  await writeFile(
    path.join(publicDirectory, reviewerRosterTemplateFile),
    reviewerRosterTemplateSerialized,
    'utf8',
  );

  const manifest = {
    roundId,
    materialVersion: reviewableCandidates[0].materialVersion,
    packetSchemaVersion: 'study2-domain-review-packet-v1',
    submissionSchemaVersion: 'study2-domain-review-submission-v2',
    packetSeed: seed,
    generatedAt: '2026-08-02T00:00:00Z',
    candidateCount: reviewableCandidates.length,
    assignmentCount: manifestEntries.length,
    reviewsPerCandidate: 2,
    reviewerRosterSchemaVersion: 'study2-reviewer-roster-v1',
    reviewerRosterTemplateFile,
    reviewerRosterTemplateSha256: sha256(reviewerRosterTemplateSerialized),
    completedReviewerRosterLocation:
      'study2/private-review-artifacts/review-round-v2/reviewer-roster.completed.json (gitignored)',
    publicSafe: true,
    crosswalkLocation: 'study2/private-review-artifacts/review-round-v2 (gitignored)',
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
