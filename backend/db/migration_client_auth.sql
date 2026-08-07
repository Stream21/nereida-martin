-- Client invite/auth: private booking access

ALTER TABLE clients
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_email_key;
DROP INDEX IF EXISTS clients_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS clients_email_unique
  ON clients (email)
  WHERE email IS NOT NULL;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(20),
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ;

UPDATE clients
SET phone_normalized = NULLIF(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '')
WHERE phone_normalized IS NULL AND phone IS NOT NULL;

-- Strip Spanish country code if present (34…)
UPDATE clients
SET phone_normalized = SUBSTRING(phone_normalized FROM 3)
WHERE phone_normalized ~ '^34[6-9][0-9]{8}$';

CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_normalized_unique
  ON clients (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS client_invites (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_invites_client ON client_invites(client_id);
CREATE INDEX IF NOT EXISTS idx_client_invites_token ON client_invites(token);

CREATE INDEX IF NOT EXISTS idx_clients_account_status ON clients(account_status);
