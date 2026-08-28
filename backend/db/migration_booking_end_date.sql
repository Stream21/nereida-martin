-- Fecha máxima de reservas online (configurable desde panel)
ALTER TABLE studio_settings
  ADD COLUMN IF NOT EXISTS booking_end_date DATE;

UPDATE studio_settings
SET booking_end_date = '2027-01-31'
WHERE id = 1 AND booking_end_date IS NULL;
