import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

import type {
  Study2RuntimeRepository,
  Study2ServerRuntimeState,
  VersionedStudy2RuntimeState,
} from './runtime-service';

export interface Study2PostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

export interface Study2PostgresClient {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<Study2PostgresQueryResult<Row>>;
}

interface StoredRuntimeRow extends Record<string, unknown> {
  revision: number;
  state_ciphertext: string;
  state_iv: string;
}

function tokenHash(accessToken: string): string {
  if (!/^[A-Za-z0-9_-]{32,256}$/u.test(accessToken)) throw new Error('Study access token is malformed.');
  return createHash('sha256').update(accessToken, 'utf8').digest('hex');
}

function base64(value: Uint8Array): string {
  return Buffer.from(value).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export function decodeStudy2RuntimeEncryptionKey(value: string): Uint8Array {
  if (!value.trim()) throw new Error('STUDY2_RUNTIME_ENCRYPTION_KEY is required.');
  const decoded = fromBase64(value);
  if (decoded.length !== 32) throw new Error('Study 2 runtime encryption key must decode to exactly 32 bytes.');
  return decoded;
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return webcrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptState(options: {
  state: Study2ServerRuntimeState;
  rawKey: Uint8Array;
  tokenDigest: string;
}): Promise<{ ciphertext: string; iv: string }> {
  const iv = randomBytes(12);
  const ciphertext = await webcrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode(options.tokenDigest),
      tagLength: 128,
    },
    await importKey(options.rawKey),
    gzipSync(Buffer.from(JSON.stringify(options.state), 'utf8')),
  );
  return { ciphertext: base64(new Uint8Array(ciphertext)), iv: base64(iv) };
}

async function decryptState(options: {
  ciphertext: string;
  iv: string;
  rawKey: Uint8Array;
  tokenDigest: string;
}): Promise<Study2ServerRuntimeState> {
  try {
    const plaintext = await webcrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(options.iv),
        additionalData: new TextEncoder().encode(options.tokenDigest),
        tagLength: 128,
      },
      await importKey(options.rawKey),
      fromBase64(options.ciphertext),
    );
    const parsed: unknown = JSON.parse(gunzipSync(Buffer.from(plaintext)).toString('utf8'));
    if (
      typeof parsed !== 'object' || parsed === null ||
      (parsed as { schemaVersion?: unknown }).schemaVersion !== 'study2-server-runtime-state-v1'
    ) throw new Error('Decrypted runtime state has an unsupported schema.');
    return parsed as Study2ServerRuntimeState;
  } catch (error) {
    throw new Error(`Study 2 runtime state failed authenticated decryption: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export class PostgresStudy2RuntimeRepository implements Study2RuntimeRepository {
  constructor(
    private readonly client: Study2PostgresClient,
    private readonly rawEncryptionKey: Uint8Array,
  ) {
    if (rawEncryptionKey.length !== 32) throw new Error('Study 2 repository requires a 32-byte encryption key.');
  }

  async create(options: {
    accessToken: string;
    state: Study2ServerRuntimeState;
  }): Promise<void> {
    const digest = tokenHash(options.accessToken);
    const encrypted = await encryptState({ state: options.state, rawKey: this.rawEncryptionKey, tokenDigest: digest });
    const result = await this.client.query(
      `INSERT INTO study2_runtime_sessions
        (access_token_hash, revision, state_ciphertext, state_iv, created_at, updated_at)
       VALUES ($1, 0, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (access_token_hash) DO NOTHING`,
      [digest, encrypted.ciphertext, encrypted.iv],
    );
    if (result.rowCount !== 1) throw new Error('Study 2 access token already identifies a runtime session.');
  }

  async createMany(entries: Array<{
    accessToken: string;
    state: Study2ServerRuntimeState;
  }>): Promise<void> {
    if (entries.length === 0) throw new Error('Study 2 runtime batch must contain at least one session.');
    const digests = entries.map((entry) => tokenHash(entry.accessToken));
    if (new Set(digests).size !== digests.length) throw new Error('Study 2 runtime batch contains duplicate access tokens.');
    const encrypted = await Promise.all(entries.map((entry, index) => encryptState({
      state: entry.state,
      rawKey: this.rawEncryptionKey,
      tokenDigest: digests[index],
    })));
    const values: unknown[] = [];
    const rows = entries.map((_, index) => {
      const offset = index * 3;
      values.push(digests[index], encrypted[index].ciphertext, encrypted[index].iv);
      return `($${offset + 1}, 0, $${offset + 2}, $${offset + 3}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    });
    const result = await this.client.query(
      `INSERT INTO study2_runtime_sessions
        (access_token_hash, revision, state_ciphertext, state_iv, created_at, updated_at)
       VALUES ${rows.join(',\n')}`,
      values,
    );
    if (result.rowCount !== entries.length) throw new Error('Study 2 runtime batch was not inserted atomically.');
  }

  async loadByAccessToken(accessToken: string): Promise<VersionedStudy2RuntimeState | null> {
    const digest = tokenHash(accessToken);
    const result = await this.client.query<StoredRuntimeRow>(
      `SELECT revision, state_ciphertext, state_iv
       FROM study2_runtime_sessions
       WHERE access_token_hash = $1`,
      [digest],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (!Number.isInteger(row.revision) || row.revision < 0 || typeof row.state_ciphertext !== 'string' || typeof row.state_iv !== 'string') {
      throw new Error('Stored Study 2 runtime row is malformed.');
    }
    return {
      revision: row.revision,
      state: await decryptState({ ciphertext: row.state_ciphertext, iv: row.state_iv, rawKey: this.rawEncryptionKey, tokenDigest: digest }),
    };
  }

  async compareAndSwap(options: {
    accessToken: string;
    expectedRevision: number;
    nextState: Study2ServerRuntimeState;
  }): Promise<boolean> {
    if (!Number.isInteger(options.expectedRevision) || options.expectedRevision < 0) throw new Error('Expected revision must be a nonnegative integer.');
    const digest = tokenHash(options.accessToken);
    const encrypted = await encryptState({ state: options.nextState, rawKey: this.rawEncryptionKey, tokenDigest: digest });
    const result = await this.client.query(
      `UPDATE study2_runtime_sessions
       SET revision = revision + 1,
           state_ciphertext = $3,
           state_iv = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE access_token_hash = $1 AND revision = $2`,
      [digest, options.expectedRevision, encrypted.ciphertext, encrypted.iv],
    );
    return result.rowCount === 1;
  }
}
