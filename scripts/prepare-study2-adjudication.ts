import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildAdjudicationQueue,
  type AdjudicationMethod,
  type AdjudicationQueue,
} from '../src/study2/adjudication';
import {
  buildAdjudicationTemplate,
  renderAdjudicationForm,
} from '../src/study2/adjudication-form';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import type { StoredPairAudit } from '../src/study2/round-finalization';

const privateDirectory = path.resolve('study2', 'private-review-artifacts', 'review-round-v2');
const publicDirectory = path.resolve('study2', 'review-round-v2');

type Manifest = {
  roundId: string;
  materialVersion: string;
  entries: Array<{ panelId: string }>;
};

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return value;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function main(): Promise<void> {
  const panelId = requiredArgument('--panel');
  const method = requiredArgument('--method') as AdjudicationMethod;
  if (!['third_expert', 'reviewer_consensus_after_lock'].includes(method)) {
    throw new Error('Method must be third_expert or reviewer_consensus_after_lock.');
  }
  const manifest = await readJson<Manifest>(path.join(publicDirectory, 'manifest.json'));
  const allowedPanels = new Set(manifest.entries.map((entry) => entry.panelId));
  if (!allowedPanels.has(panelId)) throw new Error(`Unknown adjudication panel ${panelId}.`);
  const audit = await readJson<StoredPairAudit>(path.join(privateDirectory, `${panelId}.pair-audit.json`));
  const queue = await readJson<AdjudicationQueue>(path.join(privateDirectory, `${panelId}.adjudication-queue.json`));
  const rebuilt = buildAdjudicationQueue({
    audit,
    roundId: audit.roundId,
    materialVersion: audit.materialVersion,
    panelId,
    generatedAt: queue.generatedAt,
  });
  if (audit.roundId !== manifest.roundId || audit.materialVersion !== manifest.materialVersion) {
    throw new Error('Pair audit does not match the committed review-round manifest.');
  }
  if (JSON.stringify(rebuilt) !== JSON.stringify(queue)) {
    throw new Error('Adjudication queue does not match the locked pair audit.');
  }
  if (queue.items.length === 0) throw new Error(`${panelId} has no items requiring adjudication.`);
  const template = buildAdjudicationTemplate(queue, method);
  const templatePath = path.join(privateDirectory, `${panelId}.adjudication-template.json`);
  const formPath = path.join(privateDirectory, `${panelId}.adjudication-form.html`);
  await writeFile(templatePath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  await writeFile(formPath, renderAdjudicationForm({ queue, candidates: STUDY2_CANDIDATES, method }), 'utf8');
  console.log(JSON.stringify({ valid: true, items: queue.items.length, privateTemplate: templatePath, privateForm: formPath }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
