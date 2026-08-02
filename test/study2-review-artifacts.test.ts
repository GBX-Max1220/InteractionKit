import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

type Packet = {
  reviewerId: string;
  packetSeed: string;
  materialVersion: string;
  items: Array<{ blindId: string; decisionPrompt: string }>;
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
  publicSafe: boolean;
  entries: Array<{
    reviewerId: string;
    packetFile: string;
    submissionTemplateFile: string;
    packetSha256: string;
    submissionTemplateSha256: string;
    privateCrosswalkSha256: string;
  }>;
};

const artifactDirectory = path.resolve('study2', 'review-round-v1');
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
  const first = await readArtifact<Packet>('domain-reviewer-01.packet.json');
  const second = await readArtifact<Packet>('domain-reviewer-02.packet.json');

  for (const packet of [first, second]) {
    assert.equal(packet.parsed.items.length, 27);
    assert.equal(new Set(packet.parsed.items.map((item) => item.blindId)).size, 27);
    assert.ok(packet.parsed.items.every((item) => /^S\d{2}$/.test(item.blindId)));
    assert.doesNotMatch(packet.serialized, /\b(?:strong|mixed)_\d{2}\b/);
    for (const forbidden of forbiddenPublicFields) {
      assert.equal(packet.serialized.includes(`\"${forbidden}\"`), false, forbidden);
    }
  }

  assert.notDeepEqual(
    first.parsed.items.map((item) => item.decisionPrompt),
    second.parsed.items.map((item) => item.decisionPrompt),
  );
});

test('submission templates are blank human-input forms without answer leakage', async () => {
  for (const reviewerId of ['domain-reviewer-01', 'domain-reviewer-02']) {
    const { parsed, serialized } = await readArtifact<SubmissionTemplate>(
      `${reviewerId}.submission-template.json`,
    );
    assert.equal(parsed.reviewerId, reviewerId);
    assert.equal(parsed.items.length, 27);
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

test('manifest binds both public packets to their committed bytes', async () => {
  const { parsed: manifest } = await readArtifact<Manifest>('manifest.json');
  assert.equal(manifest.roundId, 'study2-domain-review-round-v1');
  assert.equal(manifest.candidateCount, 27);
  assert.equal(manifest.publicSafe, true);
  assert.equal(manifest.entries.length, 2);

  for (const entry of manifest.entries) {
    const packet = await readArtifact<Packet>(entry.packetFile);
    const template = await readArtifact<SubmissionTemplate>(entry.submissionTemplateFile);
    assert.equal(packet.parsed.reviewerId, entry.reviewerId);
    assert.equal(template.parsed.reviewerId, entry.reviewerId);
    assert.equal(sha256(packet.serialized), entry.packetSha256);
    assert.equal(sha256(template.serialized), entry.submissionTemplateSha256);
    assert.match(entry.privateCrosswalkSha256, /^[a-f0-9]{64}$/);
  }
});
