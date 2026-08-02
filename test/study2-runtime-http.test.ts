import assert from 'node:assert/strict';
import test from 'node:test';

import {
  handleStudy2RuntimeGet,
  handleStudy2RuntimePost,
  parseStudy2RuntimeRequestBody,
  STUDY2_RUNTIME_MAX_BODY_BYTES,
} from '../src/study2/runtime-http';
import type { Study2RuntimeRepository } from '../src/study2/runtime-service';

const token = 'opaque_http_runtime_token_1234567890';

function missingRepository(): Study2RuntimeRepository {
  return {
    async loadByAccessToken() { return null; },
    async compareAndSwap() { return false; },
  };
}

test('HTTP boundary requires a strict bearer token and never caches responses', async () => {
  for (const authorization of [null, '', `Basic ${token}`, 'Bearer short', `Bearer ${token} extra`]) {
    const response = await handleStudy2RuntimeGet({ repository: missingRepository(), authorization });
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: 'unauthorized' });
    assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
  }
  const missing = await handleStudy2RuntimeGet({ repository: missingRepository(), authorization: `Bearer ${token}` });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: 'runtime_not_found' });
});

test('POST rejects oversized or non-exact envelopes before repository mutation', async () => {
  let loads = 0;
  const repository: Study2RuntimeRepository = {
    async loadByAccessToken() { loads += 1; return null; },
    async compareAndSwap() { return false; },
  };
  const oversized = await handleStudy2RuntimePost({ repository, authorization: `Bearer ${token}`, contentLength: '16385', body: {}, serverTimestamp: '2026-08-03T04:00:00.000Z' });
  assert.equal(oversized.status, 413);
  const extra = await handleStudy2RuntimePost({ repository, authorization: `Bearer ${token}`, contentLength: '100', body: { expectedRevision: 0, action: { action: 'consent', consented: true }, groundTruth: 'option_a' }, serverTimestamp: '2026-08-03T04:00:00.000Z' });
  assert.equal(extra.status, 400);
  assert.equal(loads, 0);
});

test('HTTP errors use stable public codes without echoing private exception text', async () => {
  const repository: Study2RuntimeRepository = {
    async loadByAccessToken() { throw new Error('private-session-id database diagnostic'); },
    async compareAndSwap() { return false; },
  };
  const response = await handleStudy2RuntimeGet({ repository, authorization: `Bearer ${token}` });
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'runtime_integrity_failure' });
  assert.equal(JSON.stringify(response).includes('private-session-id'), false);
});

test('raw body byte cap cannot be bypassed by omitting Content-Length', () => {
  const oversizedUnicode = JSON.stringify({ value: '界'.repeat(STUDY2_RUNTIME_MAX_BODY_BYTES) });
  const rejected = parseStudy2RuntimeRequestBody(oversizedUnicode);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.response.status, 413);

  const malformed = parseStudy2RuntimeRequestBody('{');
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.response.status, 400);
});
