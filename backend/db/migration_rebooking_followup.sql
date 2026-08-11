-- Follow-up de rebooking tras finalizar el servicio.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rebooking_sent BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_rebooking
  ON bookings (rebooking_sent, end_time)
  WHERE status = 'confirmed' AND rebooking_sent = false;
