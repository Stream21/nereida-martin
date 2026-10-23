-- Segundo recordatorio: día anterior (~24h). reminder_sent sigue siendo el de ~6h (mismo día).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_day_before_sent BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_day_before
  ON bookings (reminder_day_before_sent, start_time)
  WHERE status = 'confirmed' AND reminder_day_before_sent = false;
