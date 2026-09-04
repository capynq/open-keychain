CREATE TABLE IF NOT EXISTS seller_presets (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  params JSONB NOT NULL,
  print_profile_id TEXT NOT NULL DEFAULT 'fdm-standard-0.4',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_presets_user_updated_idx
  ON seller_presets(user_id, updated_at DESC);
