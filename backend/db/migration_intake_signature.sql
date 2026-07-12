-- Firma digital en cuestionarios de aptitud

ALTER TABLE booking_intakes
  ADD COLUMN IF NOT EXISTS signature_data TEXT,
  ADD COLUMN IF NOT EXISTS signer_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
