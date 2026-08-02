import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { study2PostgresPool } from '../lib/study2-runtime-postgres';

async function main(): Promise<void> {
  const migrationFile = path.resolve('study2', 'sql', '001_create_runtime_sessions.sql');
  const sql = await readFile(migrationFile, 'utf8');
  const pool = study2PostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('interactionkit-study2-runtime-migrations'))");
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  console.log(JSON.stringify({ migration: path.basename(migrationFile), applied: true }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
