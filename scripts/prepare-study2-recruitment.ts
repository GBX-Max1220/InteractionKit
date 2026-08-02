import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  panelRequirement,
  renderRecruitmentInvitation,
  renderReviewerScreeningForm,
  type ReviewPanelId,
} from '../src/study2/reviewer-screening';

type Manifest = {
  roundId: string;
  entries: Array<{ panelId: string; requiredDomains: string[]; itemCount: number }>;
};

const publicDirectory = path.resolve('study2', 'review-round-v2');
const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2', 'recruitment');

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
  const panelId = requiredArgument('--panel');
  const compensationStatement = requiredArgument('--compensation');
  const returnContact = requiredArgument('--contact');
  if (/\[(?:set|insert|todo)|tbd|placeholder/i.test(compensationStatement)) {
    throw new Error('Compensation must be a final fixed or voluntary statement, not a placeholder.');
  }
  if (/\[(?:set|insert|todo)|tbd|placeholder/i.test(returnContact)) {
    throw new Error('Return contact must be final, not a placeholder.');
  }
  if (/agreement|retention|favorable|completion speed|target distribution/i.test(compensationStatement)) {
    throw new Error('Compensation statement must not mention judgment- or outcome-contingent terms.');
  }
  const requirement = panelRequirement(panelId);
  if (!requirement) throw new Error(`Unknown recruitment panel ${panelId}.`);
  const manifest = JSON.parse(
    await readFile(path.join(publicDirectory, 'manifest.json'), 'utf8'),
  ) as Manifest;
  const entries = manifest.entries.filter((entry) => entry.panelId === panelId);
  if (entries.length !== 2) throw new Error(`${panelId} must have exactly two reviewer assignments.`);
  if (
    entries.some(
      (entry) =>
        entry.itemCount !== requirement.itemCount ||
        JSON.stringify([...entry.requiredDomains].sort()) !==
          JSON.stringify([...requirement.domains].sort()),
    )
  ) {
    throw new Error('Recruitment requirements do not match the committed review manifest.');
  }
  const invitation = renderRecruitmentInvitation({
    panelId: panelId as ReviewPanelId,
    compensationStatement,
    returnContact,
  });
  const form = renderReviewerScreeningForm({
    panelId: panelId as ReviewPanelId,
    compensationStatement,
  });
  await mkdir(privateDirectory, { recursive: true });
  const invitationFile = `${panelId}.invitation.txt`;
  const formFile = `${panelId}.screening-form.html`;
  await writeFile(path.join(privateDirectory, invitationFile), invitation, 'utf8');
  await writeFile(path.join(privateDirectory, formFile), form, 'utf8');
  await writeFile(
    path.join(privateDirectory, `${panelId}.recruitment-manifest.json`),
    `${JSON.stringify(
      {
        schemaVersion: 'study2-reviewer-recruitment-kit-v1',
        roundId: manifest.roundId,
        panelId,
        itemCount: requirement.itemCount,
        requiredDomains: requirement.domains,
        compensationStatement,
        returnContact,
        invitationFile,
        invitationSha256: sha256(invitation),
        screeningFormFile: formFile,
        screeningFormSha256: sha256(form),
        generatedAt: new Date().toISOString(),
        dispatchDoesNotEstablishEligibility: true,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(JSON.stringify({ valid: true, panelId, privateDirectory }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
