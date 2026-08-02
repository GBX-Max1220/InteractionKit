import { Pool, type QueryResultRow } from 'pg';

import {
  decodeStudy2RuntimeEncryptionKey,
  PostgresStudy2RuntimeRepository,
  type Study2PostgresClient,
  type Study2PostgresQueryResult,
} from '@/src/study2/runtime-repository-postgres';

declare global {
  var __interactionKitStudy2Pool: Pool | undefined;
}

function databaseUrl(): string {
  const value = process.env.STUDY2_DATABASE_URL;
  if (!value?.trim()) throw new Error('STUDY2_DATABASE_URL is required.');
  return value;
}

export function study2DatabaseSsl(options: {
  mode?: string;
  encodedCa?: string;
}): false | { ca: string; rejectUnauthorized: true } {
  if (options.mode === 'disable') return false;
  const encodedCa = options.encodedCa;
  if (!encodedCa?.trim()) {
    throw new Error('STUDY2_DATABASE_CA_BASE64 is required unless STUDY2_DATABASE_SSL=disable.');
  }
  const ca = Buffer.from(encodedCa, 'base64').toString('utf8');
  if (!ca.includes('BEGIN CERTIFICATE')) throw new Error('STUDY2_DATABASE_CA_BASE64 is invalid.');
  return { ca, rejectUnauthorized: true };
}

function pool(): Pool {
  if (!globalThis.__interactionKitStudy2Pool) {
    globalThis.__interactionKitStudy2Pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: study2DatabaseSsl({
        mode: process.env.STUDY2_DATABASE_SSL,
        encodedCa: process.env.STUDY2_DATABASE_CA_BASE64,
      }),
    });
  }
  return globalThis.__interactionKitStudy2Pool;
}

class PgClientAdapter implements Study2PostgresClient {
  async query<Row extends Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ): Promise<Study2PostgresQueryResult<Row>> {
    const response = await pool().query<Row & QueryResultRow>(text, values);
    return { rows: response.rows, rowCount: response.rowCount };
  }
}

export function study2RuntimeRepository(): PostgresStudy2RuntimeRepository {
  return new PostgresStudy2RuntimeRepository(
    new PgClientAdapter(),
    decodeStudy2RuntimeEncryptionKey(process.env.STUDY2_RUNTIME_ENCRYPTION_KEY ?? ''),
  );
}
