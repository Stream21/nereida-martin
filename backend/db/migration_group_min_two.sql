-- Allow group bookings from 2 participants (owner replaces conjunto de 2)

ALTER TABLE booking_groups
  DROP CONSTRAINT IF EXISTS booking_groups_participant_count_check;

ALTER TABLE booking_groups
  ADD CONSTRAINT booking_groups_participant_count_check
  CHECK (participant_count >= 2 AND participant_count <= 6);
