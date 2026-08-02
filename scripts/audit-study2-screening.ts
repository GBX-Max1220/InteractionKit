import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  validateReviewerScreeningResponse,
  type ReviewerScreeningResponse,
} from '../src/study2/reviewer-screening';

type RecruitmentManifest = {
  schemaVersion: 'study2-reviewer-recruitment-kit-v1';
  roundId: string;
  panelId: ReviewerScreeningResponse['panelId'];
  compensationStatement: string;
};

const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2', 'recruitment');

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
  const responsePath = requiredArgument('--response');
  const serialized = await readFile(responsePath, 'utf8');
  const response = JSON.parse(serialized) as unknown;
  const panelId =
    typeof response === 'object' && response !== null && 'panelId' in response
      ? String(response.panelId)
      : '';
  if (!/^[a-z-]+$/.test(panelId)) throw new Error('Screening response has an invalid panel identifier.');
  const manifest = JSON.parse(
    await readFile(path.join(privateDirectory, `${panelId}.recruitment-manifest.json`), 'utf8'),
  ) as RecruitmentManifest;
  if (
    manifest.schemaVersion !== 'study2-reviewer-recruitment-kit-v1' ||
    manifest.panelId !== panelId ||
    manifest.roundId !== 'study2-domain-review-round-v2'
  ) {
    throw new Error('Recruitment manifest is invalid or mismatched.');
  }
  const validation = validateReviewerScreeningResponse(response, {
    expectedPanelId: manifest.panelId,
    expectedCompensationStatement: manifest.compensationStatement,
  });
  const auditPath = path.join(
    privateDirectory,
    `${panelId}.${sha256(serialized).slice(0, 12)}.screening-audit.json`,
  );
  await writeFile(
    auditPath,
    `${JSON.stringify(
      {
        schemaVersion: 'study2-reviewer-screening-audit-v1',
        roundId: manifest.roundId,
        panelId,
        sourceResponseFile: path.basename(responsePath),
        sourceResponseSha256: sha256(serialized),
        auditedAt: new Date().toISOString(),
        ...validation,
        eligibilityDecision: 'requires_manual_verification',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  if (!validation.valid) throw new Error(`Screening response is invalid:\n${validation.errors.join('\n')}`);
  console.log(
    JSON.stringify(
      {
        valid: true,
        eligibilityDecision: 'requires_manual_verification',
        privateAudit: auditPath,
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
