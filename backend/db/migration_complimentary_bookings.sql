-- Citas de cortesía (amigas / sin cobro), p. ej. fuera del horario público.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS complimentary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN bookings.complimentary IS
  'Cita sin cobro (amiga). Permite horario fuera de ventanas públicas solo desde agenda owner.';
