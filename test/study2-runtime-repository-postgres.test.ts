import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeStudy2RuntimeEncryptionKey,
  PostgresStudy2RuntimeRepository,
  type Study2PostgresClient,
  type Study2PostgresQueryResult,
} from '../src/study2/runtime-repository-postgres';
import type { Study2ServerRuntimeState } from '../src/study2/runtime-service';

interface Row {
  revision: number;
  state_ciphertext: string;
  state_iv: string;
}

class FakePostgres implements Study2PostgresClient {
  rows = new Map<string, Row>();
  calls: { text: string; values: unknown[] }[] = [];
  async query<ResultRow extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<Study2PostgresQueryResult<ResultRow>> {
    this.calls.push({ text, values });
    const digest = String(values[0]);
    if (text.includes('INSERT INTO')) {
      if (!text.includes('ON CONFLICT')) {
        for (let index = 0; index < values.length; index += 3) {
          const batchDigest = String(values[index]);
          if (this.rows.has(batchDigest)) throw new Error('duplicate key');
        }
        for (let index = 0; index < values.length; index += 3) {
          this.rows.set(String(values[index]), {
            revision: 0,
            state_ciphertext: String(values[index + 1]),
            state_iv: String(values[index + 2]),
          });
        }
        return { rows: [], rowCount: values.length / 3 };
      }
      if (this.rows.has(digest)) return { rows: [], rowCount: 0 };
      this.rows.set(digest, { revision: 0, state_ciphertext: String(values[1]), state_iv: String(values[2]) });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes('SELECT revision')) {
      const row = this.rows.get(digest);
      return { rows: (row ? [structuredClone(row)] : []) as unknown as ResultRow[], rowCount: row ? 1 : 0 };
    }
    if (text.includes('UPDATE study2_runtime_sessions')) {
      const row = this.rows.get(digest);
      if (!row || row.revision !== values[1]) return { rows: [], rowCount: 0 };
      this.rows.set(digest, { revision: row.revision + 1, state_ciphertext: String(values[2]), state_iv: String(values[3]) });
      return { rows: [], rowCount: 1 };
    }
    throw new Error('Unexpected SQL in test fake.');
  }
}

const token = 'opaque_postgres_runtime_token_123456789';
const key = new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1));
const state = {
  schemaVersion: 'study2-server-runtime-state-v1',
  allocation: { schemaVersion: 'study2-allocation-v1', materialVersion: 'm1', seed: 'private-seed', participants: 24, trials: [] },
  bundle: { schemaVersion: 'study2-delivery-materials-v1', roundId: 'r', frozenMaterialVersion: 'm1', answerVariantVersion: 'a', interventionCardVersion: 'c', sourceFrozenMaterialsSha256: 'f'.repeat(64), variants: [] },
  frozen: { schemaVersion: 'study2-frozen-materials-v1', roundId: 'r', materialVersion: 'm1', sourceOutcomeSha256: 'a'.repeat(64), sourceSelectionSha256: 'b'.repeat(64), items: [] },
  identity: { sessionId: 'private-session', participantId: 'private-participant', participantIndex: 0 },
  recruitmentSource: 'private-source',
  store: { schemaVersion: 'study2-session-store-v1', participantIndex: 0, allocationSha256: 'c'.repeat(64), records: [] },
} satisfies Study2ServerRuntimeState;

test('repository stores only token hash and authenticated ciphertext, then decrypts exact state', async () => {
  const client = new FakePostgres();
  const repository = new PostgresStudy2RuntimeRepository(client, key);
  await repository.create({ accessToken: token, state });
  assert.equal(client.rows.size, 1);
  const [digest, row] = [...client.rows.entries()][0];
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest.includes(token), false);
  assert.equal(row.state_ciphertext.includes('private-session'), false);
  assert.equal(row.state_ciphertext.includes('private-seed'), false);
  assert.ok(row.state_ciphertext.length < Buffer.byteLength(JSON.stringify(state), 'utf8') * 2);
  const loaded = await repository.loadByAccessToken(token);
  assert.deepEqual(loaded, { revision: 0, state });
});

test('repository CAS increments exactly once and rejects stale revision', async () => {
  const client = new FakePostgres();
  const repository = new PostgresStudy2RuntimeRepository(client, key);
  await repository.create({ accessToken: token, state });
  const nextState = structuredClone(state);
  nextState.recruitmentSource = 'updated-private-source';
  assert.equal(await repository.compareAndSwap({ accessToken: token, expectedRevision: 0, nextState }), true);
  assert.equal(await repository.compareAndSwap({ accessToken: token, expectedRevision: 0, nextState: state }), false);
  assert.deepEqual(await repository.loadByAccessToken(token), { revision: 1, state: nextState });
});

test('ciphertext is bound to token hash and tampering fails authenticated decryption', async () => {
  const client = new FakePostgres();
  const repository = new PostgresStudy2RuntimeRepository(client, key);
  await repository.create({ accessToken: token, state });
  const row = [...client.rows.values()][0];
  row.state_ciphertext = `${row.state_ciphertext.slice(0, -2)}AA`;
  await assert.rejects(repository.loadByAccessToken(token), /failed authenticated decryption/);

  const secondToken = 'different_opaque_runtime_token_123456789';
  const secondClient = new FakePostgres();
  const secondRepository = new PostgresStudy2RuntimeRepository(secondClient, key);
  await secondRepository.create({ accessToken: token, state });
  await secondRepository.create({ accessToken: secondToken, state });
  const rows = [...secondClient.rows.values()];
  rows[1].state_ciphertext = rows[0].state_ciphertext;
  rows[1].state_iv = rows[0].state_iv;
  await assert.rejects(secondRepository.loadByAccessToken(secondToken), /failed authenticated decryption/);
});

test('encryption key parsing is strict and duplicate token creation fails closed', async () => {
  assert.deepEqual(decodeStudy2RuntimeEncryptionKey(Buffer.from(key).toString('base64')), key);
  assert.throws(() => decodeStudy2RuntimeEncryptionKey(Buffer.from('short').toString('base64')), /exactly 32 bytes/);
  const client = new FakePostgres();
  const repository = new PostgresStudy2RuntimeRepository(client, key);
  await repository.create({ accessToken: token, state });
  await assert.rejects(repository.create({ accessToken: token, state }), /already identifies/);
});

test('repository creates an encrypted runtime batch with one atomic insert', async () => {
  const client = new FakePostgres();
  const repository = new PostgresStudy2RuntimeRepository(client, key);
  const secondToken = 'second_opaque_runtime_token_123456789';
  await repository.createMany([
    { accessToken: token, state },
    { accessToken: secondToken, state: { ...state, recruitmentSource: 'second-source' } },
  ]);
  assert.equal(client.rows.size, 2);
  assert.equal(client.calls.length, 1);
  assert.deepEqual(await repository.loadByAccessToken(secondToken), {
    revision: 0,
    state: { ...state, recruitmentSource: 'second-source' },
  });
  await assert.rejects(
    repository.createMany([{ accessToken: token, state }, { accessToken: token, state }]),
    /duplicate access tokens/u,
  );
});
