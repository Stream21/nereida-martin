-- Joint perfilado bookings (client + companion)

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS joint_group_id UUID,
  ADD COLUMN IF NOT EXISTS joint_role VARCHAR(20);

CREATE TABLE IF NOT EXISTS joint_booking_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  companion_booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  companion_client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_companion',
  confirm_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_joint_group_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_joint_group_id_fkey
  FOREIGN KEY (joint_group_id) REFERENCES joint_booking_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_joint_group ON bookings(joint_group_id)
  WHERE joint_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_joint_groups_status_expires
  ON joint_booking_groups(status, expires_at)
  WHERE status = 'pending_companion';

CREATE INDEX IF NOT EXISTS idx_joint_groups_confirm_token
  ON joint_booking_groups(confirm_token);

-- Block slots while awaiting companion confirmation
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlap;
ALTER TABLE bookings ADD CONSTRAINT no_overlap EXCLUDE USING gist (
  tstzrange(start_time, end_time) WITH &&
) WHERE (status IN ('confirmed', 'pending_review', 'pending_companion'));

-- Virtual treatment for joint perfilado bookings
INSERT INTO treatments (id, category, name, tag, duration_min, duration_max, price, active)
VALUES ('perfilado-conjunto', 'cejas', 'Perfilado Conjunto', 'Dos perfilados seguidos · precio según historial', 60, NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;
