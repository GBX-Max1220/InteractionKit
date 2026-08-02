import assert from 'node:assert/strict';
import test from 'node:test';

import { study2DatabaseSsl } from '../lib/study2-runtime-postgres';

test('PostgreSQL TLS requires an explicit trusted CA outside local development', () => {
  assert.throws(() => study2DatabaseSsl({}), /STUDY2_DATABASE_CA_BASE64 is required/u);
  assert.throws(
    () => study2DatabaseSsl({ encodedCa: Buffer.from('not a certificate').toString('base64') }),
    /is invalid/u,
  );
  assert.equal(study2DatabaseSsl({ mode: 'disable' }), false);
  const ca = '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
  assert.deepEqual(study2DatabaseSsl({ encodedCa: Buffer.from(ca).toString('base64') }), {
    ca,
    rejectUnauthorized: true,
  });
});
