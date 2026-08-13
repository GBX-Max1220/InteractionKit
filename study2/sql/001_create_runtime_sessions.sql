CREATE TABLE IF NOT EXISTS study2_runtime_sessions (
  access_token_hash CHAR(64) PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state_ciphertext TEXT NOT NULL,
  state_iv TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

REVOKE ALL ON study2_runtime_sessions FROM PUBLIC;

COMMENT ON TABLE study2_runtime_sessions IS
  'Server-only encrypted Study 2 runtime state. Raw access tokens and participant-visible semantic condition IDs are never stored.';
