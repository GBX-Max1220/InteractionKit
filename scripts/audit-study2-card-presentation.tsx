import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  STUDY2_CARD_PRESENTATION_CSS,
  Study2InterventionCard,
} from '../components/study2-intervention-card';
import { STUDY2_CANDIDATES } from '../src/study2/candidate-registry';
import {
  auditCardPresentationGeometry,
  CARD_PRESENTATION_VIEWPORTS,
  type CardGeometryMeasurement,
} from '../src/study2/card-presentation-audit';
import { auditDeliveryMaterials, type Study2DeliveryMaterials } from '../src/study2/delivery-materials';
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
const outputDirectory = path.join(privateDirectory, 'card-presentation-v1');

function requiredPath(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}.`);
  return path.resolve(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function chromeExecutable(): string {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  throw new Error('Chrome/Chromium is required for deterministic card geometry audit. Set CHROME_PATH if it is installed elsewhere.');
}

function htmlDocument(bundle: Study2DeliveryMaterials, auditViewportWidth: number): string {
  const markup = renderToStaticMarkup(
    <main className="audit-list">
      {bundle.variants.flatMap((variant) =>
        variant.cards.map((card) => (
          <div className="audit-frame" data-variant-id={variant.variantId} data-card-id={card.cardId} key={card.cardId}>
            <Study2InterventionCard card={card} />
          </div>
        )),
      )}
    </main>,
  );
  const measurementScript = `
const measurements=[...document.querySelectorAll('.audit-frame')].map(frame=>{const card=frame.querySelector('.s2-intervention-card');const cardRect=card.getBoundingClientRect();const rows=[...card.querySelectorAll('.s2-intervention-card__row')].map(row=>{const rect=row.getBoundingClientRect();return{top:rect.top-cardRect.top,height:rect.height}});return{viewportWidth:Number(document.body.dataset.auditViewport),variantId:frame.dataset.variantId,cardId:frame.dataset.cardId,width:cardRect.width,height:cardRect.height,clientWidth:card.clientWidth,scrollWidth:card.scrollWidth,rowTops:rows.map(row=>row.top),rowHeights:rows.map(row=>row.height)}});
document.getElementById('geometry-results').textContent=JSON.stringify(measurements);`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${STUDY2_CARD_PRESENTATION_CSS}\n*{box-sizing:border-box}body{margin:0;width:${auditViewportWidth}px;background:#eef2f7}.audit-list{display:grid;gap:24px;padding:16px}.audit-frame{width:min(42rem,100%);margin:0 auto}</style></head><body data-audit-viewport="${auditViewportWidth}">${markup}<script id="geometry-results" type="application/json"></script><script>${measurementScript}</script></body></html>`;
}

function extractMeasurements(dumpedHtml: string): CardGeometryMeasurement[] {
  const match = dumpedHtml.match(/<script id="geometry-results" type="application\/json">([\s\S]*?)<\/script>/u);
  if (!match?.[1]) throw new Error('Browser geometry output is missing or empty.');
  const value: unknown = JSON.parse(match[1]);
  if (!Array.isArray(value)) throw new Error('Browser geometry output is not an array.');
  return value as CardGeometryMeasurement[];
}

async function main(): Promise<void> {
  const bundlePath = requiredPath('--bundle');
  const authoringManifestSerialized = await readFile(path.join(authoringDirectory, 'manifest.json'), 'utf8');
  const authoringManifest = JSON.parse(authoringManifestSerialized) as AuthoringManifest;
  if (
    authoringManifest.schemaVersion !== 'study2-delivery-authoring-manifest-v1' ||
    path.basename(authoringManifest.sourceFrozenMaterialsFile) !== authoringManifest.sourceFrozenMaterialsFile
  ) throw new Error('Delivery-authoring manifest is invalid.');
  const frozenSerialized = await readFile(path.join(privateDirectory, authoringManifest.sourceFrozenMaterialsFile), 'utf8');
  if (sha256(frozenSerialized) !== authoringManifest.sourceFrozenMaterialsSha256) throw new Error('Frozen materials no longer match the authoring manifest.');
  const bundleSerialized = await readFile(bundlePath, 'utf8');
  const bundle = JSON.parse(bundleSerialized) as Study2DeliveryMaterials;
  const frozen = JSON.parse(frozenSerialized) as FrozenStudy2MaterialsArtifact;
  const deliveryAudit = auditDeliveryMaterials({
    bundle,
    frozen,
    candidates: STUDY2_CANDIDATES,
    expectedFrozenMaterialsSha256: authoringManifest.sourceFrozenMaterialsSha256,
    expectedAnswerVariantVersion: authoringManifest.answerVariantVersion,
    expectedInterventionCardVersion: authoringManifest.interventionCardVersion,
  });
  if (!deliveryAudit.structurallyValid) throw new Error(`Cannot audit presentation of invalid delivery materials:\n${deliveryAudit.errors.join('\n')}`);
  const expectedVariantCardIds = new Map(bundle.variants.map((variant) => [variant.variantId, variant.cards.map((card) => card.cardId)]));
  const rendererSource = await readFile(path.resolve('components', 'study2-intervention-card.tsx'), 'utf8');
  const temporaryHtmlPath = path.join(os.tmpdir(), `interactionkit-card-presentation-${process.pid}-${Date.now()}.html`);
  const temporaryProfilePath = await mkdtemp(path.join(os.tmpdir(), 'interactionkit-chrome-profile-'));
  const measurements: CardGeometryMeasurement[] = [];
  try {
    const chrome = chromeExecutable();
    for (const viewportWidth of CARD_PRESENTATION_VIEWPORTS) {
      await writeFile(temporaryHtmlPath, htmlDocument(bundle, viewportWidth), 'utf8');
      const result = spawnSync(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        `--user-data-dir=${temporaryProfilePath}`,
        `--window-size=${Math.max(900, viewportWidth)},900`,
        '--virtual-time-budget=1000',
        '--dump-dom',
        pathToFileURL(temporaryHtmlPath).href,
      ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
      if (result.error || result.status !== 0) throw new Error(`Browser geometry capture failed at ${viewportWidth}px: ${result.error?.message ?? result.stderr}`);
      const viewportMeasurements = extractMeasurements(result.stdout);
      if (viewportMeasurements.some((measurement) => measurement.viewportWidth !== viewportWidth)) {
        throw new Error(`Browser did not honor the requested ${viewportWidth}px viewport.`);
      }
      measurements.push(...viewportMeasurements);
    }
  } finally {
    await unlink(temporaryHtmlPath).catch(() => undefined);
    await rm(temporaryProfilePath, { recursive: true, force: true }).catch(() => undefined);
  }
  const audit = auditCardPresentationGeometry({ measurements, expectedVariantCardIds });
  const artifact = {
    schemaVersion: 'study2-card-presentation-geometry-audit-v1',
    sourceBundleFile: path.basename(bundlePath),
    sourceBundleSha256: sha256(bundleSerialized),
    sourceFrozenMaterialsSha256: authoringManifest.sourceFrozenMaterialsSha256,
    sourceAuthoringManifestSha256: sha256(authoringManifestSerialized),
    sourceRendererSha256: sha256(rendererSource),
    chromeViewports: CARD_PRESENTATION_VIEWPORTS,
    auditedAt: new Date().toISOString(),
    ...audit,
  };
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, 'card-presentation.geometry-audit.json');
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ valid: audit.valid, equivalent: audit.equivalent, counts: audit.counts, privateAudit: outputPath }, null, 2));
  if (!audit.equivalent) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
