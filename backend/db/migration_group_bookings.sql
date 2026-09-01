-- Group perfilado bookings (3+ participants, owner-only)

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS owner_only BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS group_booking_id UUID;

CREATE TABLE IF NOT EXISTS booking_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id VARCHAR(80) NOT NULL REFERENCES treatments(id),
  participant_count INTEGER NOT NULL,
  person_block_minutes INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
  source VARCHAR(20) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT booking_groups_participant_count_check
    CHECK (participant_count >= 2 AND participant_count <= 6)
);

CREATE TABLE IF NOT EXISTS booking_group_members (
  group_id UUID NOT NULL REFERENCES booking_groups(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  position INTEGER NOT NULL,
  resolved_treatment_id VARCHAR(80) NOT NULL REFERENCES treatments(id),
  PRIMARY KEY (booking_id),
  UNIQUE (group_id, position),
  UNIQUE (group_id, client_id)
);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_group_booking_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_group_booking_id_fkey
  FOREIGN KEY (group_booking_id) REFERENCES booking_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_group_booking
  ON bookings(group_booking_id)
  WHERE group_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_group_members_group
  ON booking_group_members(group_id);

INSERT INTO treatments (id, category, name, tag, duration_min, duration_max, price, active, owner_only)
VALUES (
  'perfilado-grupo',
  'cejas',
  'Perfilado en grupo',
  'Varias clientas seguidas · precio según historial',
  90,
  NULL,
  NULL,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  tag = EXCLUDED.tag,
  duration_min = EXCLUDED.duration_min,
  duration_max = EXCLUDED.duration_max,
  price = EXCLUDED.price,
  active = true,
  owner_only = true;

COMMENT ON COLUMN treatments.owner_only IS
  'Si true, solo reservable desde el panel de Nereida (no aparece en reserva online).';

COMMENT ON TABLE booking_groups IS
  'Citas de perfilado en grupo (3-6 clientas consecutivas, owner-only).';
