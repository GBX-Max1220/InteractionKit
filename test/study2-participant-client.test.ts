import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('components/study2-participant-runner.tsx', 'utf8');

test('participant client consumes only the public runtime boundary', () => {
  assert.match(source, /import type \{ Study2RuntimeResponse \}/u);
  assert.match(source, /import type \{ Study2ParticipantAction \}/u);
  for (const forbidden of [
    'runtime-repository-postgres',
    'session-store',
    'allocation.json',
    'frozen-materials',
    'localStorage',
  ]) {
    assert.equal(source.includes(forbidden), false, `participant client contains forbidden dependency ${forbidden}`);
  }
});

test('access link is removed before runtime content renders and requests omit credentials', () => {
  const eraseIndex = source.indexOf('window.history.replaceState');
  const acceptIndex = source.indexOf('acceptRuntime(initial)');
  assert.ok(eraseIndex >= 0 && acceptIndex > eraseIndex);
  assert.match(source, /window\.sessionStorage\.setItem/u);
  assert.match(source, /credentials: 'omit'/u);
  assert.match(source, /referrerPolicy: 'no-referrer'/u);
  assert.match(source, /cache: 'no-store'/u);
});
