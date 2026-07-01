CREATE TABLE IF NOT EXISTS admin_passkeys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id TEXT UNIQUE NOT NULL,
  public_key    TEXT NOT NULL,
  counter       BIGINT NOT NULL DEFAULT 0,
  user_email    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on admin_passkeys" ON admin_passkeys FOR ALL USING (true);
