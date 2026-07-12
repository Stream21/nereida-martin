-- Client experience: profiles, intakes, consents, henna assessments, owner tokens

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS declared_profile VARCHAR(30),
  ADD COLUMN IF NOT EXISTS first_booking_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_booking_at TIMESTAMPTZ;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS visit_context VARCHAR(30),
  ADD COLUMN IF NOT EXISTS review_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS intake_id INTEGER;

-- Extend overlap constraint to block pending_review slots too
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlap;
ALTER TABLE bookings ADD CONSTRAINT no_overlap EXCLUDE USING gist (
  tstzrange(start_time, end_time) WITH &&
) WHERE (status IN ('confirmed', 'pending_review'));

CREATE TABLE IF NOT EXISTS booking_intakes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  treatment_id VARCHAR(50) REFERENCES treatments(id),
  intake_type VARCHAR(30) NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_consents (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  consent_type VARCHAR(40) NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, consent_type)
);

CREATE TABLE IF NOT EXISTS henna_assessments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  photo_path VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS owner_action_tokens (
  id SERIAL PRIMARY KEY,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  action VARCHAR(40) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_intake_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_intake_id_fkey
  FOREIGN KEY (intake_id) REFERENCES booking_intakes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_intakes_client ON booking_intakes(client_id);
CREATE INDEX IF NOT EXISTS idx_henna_assessments_client ON henna_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_henna_assessments_booking ON henna_assessments(booking_id);
CREATE INDEX IF NOT EXISTS idx_owner_tokens_token ON owner_action_tokens(token);
