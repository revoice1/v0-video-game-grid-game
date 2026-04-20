CREATE TABLE IF NOT EXISTS app_runtime_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_runtime_flags ENABLE ROW LEVEL SECURITY;
