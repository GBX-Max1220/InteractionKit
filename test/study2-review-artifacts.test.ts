import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

type Packet = {
  reviewerId: string;
  packetSeed: string;
  materialVersion: string;
  items: Array<{ blindId: string; decisionPrompt: string; domain: string }>;
};

type SubmissionTemplate = {
  reviewerId: string;
  relevantExpertise: string;
  conflictOfInterestStatement: string;
  submittedAt: string;
  items: Array<{
    blindId: string;
    binaryDecision: string;
    supportLevel: string;
    sourceConcern: string;
    recommendation: string;
  }>;
};

type Manifest = {
  roundId: string;
  candidateCount: number;
  assignmentCount: number;
  reviewsPerCandidate: number;
  publicSafe: boolean;
  entries: Array<{
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
  }>;
};

const artifactDirectory = path.resolve('study2', 'review-round-v2');
const forbiddenPublicFields = [
  'candidateId',
  'provisionalCorrectOption',
  'provisionalSupportLevel',
  'authoringNotes',
  'intendedDecisionBoundary',
];

async function readArtifact<T>(file: string): Promise<{ parsed: T; serialized: string }> {
  const serialized = await readFile(path.join(artifactDirectory, file), 'utf8');
  return { parsed: JSON.parse(serialized) as T, serialized };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

test('committed review packets are complete, blinded, and reviewer-specific', async () => {
  const { parsed: manifest } = await readArtifact<Manifest>('manifest.json');
  const promptCoverage = new Map<string, number>();
  const packetsByPanel = new Map<string, Packet[]>();

  for (const entry of manifest.entries) {
    const packet = await readArtifact<Packet>(entry.packetFile);
    assert.equal(packet.parsed.items.length, entry.itemCount);
    assert.equal(
      new Set(packet.parsed.items.map((item) => item.blindId)).size,
      entry.itemCount,
    );
    assert.ok(packet.parsed.items.every((item) => /^S\d{2}$/.test(item.blindId)));
    assert.ok(
      packet.parsed.items.every((item) => entry.requiredDomains.includes(item.domain)),
    );
    assert.doesNotMatch(packet.serialized, /\b(?:strong|mixed)_\d{2}\b/);
    for (const forbidden of forbiddenPublicFields) {
      assert.equal(packet.serialized.includes(`\"${forbidden}\"`), false, forbidden);
    }
    for (const item of packet.parsed.items) {
      promptCoverage.set(item.decisionPrompt, (promptCoverage.get(item.decisionPrompt) ?? 0) + 1);
    }
    packetsByPanel.set(entry.panelId, [
      ...(packetsByPanel.get(entry.panelId) ?? []),
      packet.parsed,
    ]);
  }

  assert.equal(promptCoverage.size, 27);
  assert.ok([...promptCoverage.values()].every((count) => count === 2));
  for (const packets of packetsByPanel.values()) {
    assert.equal(packets.length, 2);
    assert.deepEqual(
      new Set(packets[0].items.map((item) => item.decisionPrompt)),
      new Set(packets[1].items.map((item) => item.decisionPrompt)),
    );
    if (packets[0].items.length > 1) {
      assert.notDeepEqual(
        packets[0].items.map((item) => item.decisionPrompt),
        packets[1].items.map((item) => item.decisionPrompt),
      );
    }
  }
});

test('submission templates are blank human-input forms without answer leakage', async () => {
  const { parsed: manifest } = await readArtifact<Manifest>('manifest.json');
  for (const entry of manifest.entries) {
    const { parsed, serialized } = await readArtifact<SubmissionTemplate>(
      entry.submissionTemplateFile,
    );
    assert.equal(parsed.reviewerId, entry.reviewerId);
    assert.equal(parsed.items.length, entry.itemCount);
    assert.equal(parsed.relevantExpertise, '');
    assert.equal(parsed.conflictOfInterestStatement, '');
    assert.equal(parsed.submittedAt, '');
    assert.ok(parsed.items.every((item) => item.binaryDecision === 'unresolved'));
    assert.ok(parsed.items.every((item) => item.supportLevel === 'unresolved'));
    assert.ok(parsed.items.every((item) => item.sourceConcern === ''));
    assert.ok(parsed.items.every((item) => item.recommendation === 'revise'));
    assert.doesNotMatch(serialized, /\b(?:strong|mixed)_\d{2}\b/);
    for (const forbidden of forbiddenPublicFields) {
      assert.equal(serialized.includes(`\"${forbidden}\"`), false, forbidden);
    }
  }
});

test('manifest binds every expertise-stratified artifact to its committed bytes', async () => {
  const { parsed: manifest } = await readArtifact<Manifest>('manifest.json');
  assert.equal(manifest.roundId, 'study2-domain-review-round-v2');
  assert.equal(manifest.candidateCount, 27);
  assert.equal(manifest.assignmentCount, 6);
  assert.equal(manifest.reviewsPerCandidate, 2);
  assert.equal(manifest.publicSafe, true);
  assert.equal(manifest.entries.length, 6);
  assert.deepEqual(
    new Set(manifest.entries.map((entry) => entry.panelId)),
    new Set(['exercise-physiology', 'sports-nutrition', 'sports-medicine']),
  );

  for (const entry of manifest.entries) {
    const packet = await readArtifact<Packet>(entry.packetFile);
    const template = await readArtifact<SubmissionTemplate>(entry.submissionTemplateFile);
    const reviewerForm = await readFile(
      path.join(artifactDirectory, entry.reviewerFormFile),
      'utf8',
    );
    assert.equal(packet.parsed.reviewerId, entry.reviewerId);
    assert.equal(template.parsed.reviewerId, entry.reviewerId);
    assert.equal(sha256(packet.serialized), entry.packetSha256);
    assert.equal(sha256(template.serialized), entry.submissionTemplateSha256);
    assert.equal(sha256(reviewerForm), entry.reviewerFormSha256);
    assert.match(reviewerForm, /This file sends no data to a server/);
    assert.match(reviewerForm, /study2-domain-review-submission-v2/);
    assert.equal(
      (reviewerForm.match(/<section class="card"/g) ?? []).length,
      entry.itemCount,
    );
    assert.equal(
      (reviewerForm.match(/<textarea data-field=/g) ?? []).length,
      entry.itemCount * 4,
    );
    assert.equal(
      (reviewerForm.match(/type="radio"/g) ?? []).length,
      entry.itemCount * 9,
    );
    assert.doesNotMatch(
      reviewerForm,
      /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/,
    );
    assert.match(reviewerForm, /connect-src 'none'/);
    assert.doesNotMatch(reviewerForm, /\b(?:strong|mixed)_\d{2}\b/);
    for (const forbidden of forbiddenPublicFields) {
      assert.equal(reviewerForm.includes(`\"${forbidden}\"`), false, forbidden);
    }
    assert.match(entry.privateCrosswalkSha256, /^[a-f0-9]{64}$/);
  }
});
