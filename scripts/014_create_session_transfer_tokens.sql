CREATE TABLE IF NOT EXISTS session_transfer_tokens (
  token text PRIMARY KEY,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS session_transfer_tokens_expires_at_idx
  ON session_transfer_tokens (expires_at);

CREATE INDEX IF NOT EXISTS session_transfer_tokens_active_idx
  ON session_transfer_tokens (session_id, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE session_transfer_tokens ENABLE ROW LEVEL SECURITY;
