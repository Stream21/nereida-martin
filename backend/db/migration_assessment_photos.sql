-- Fotos de solicitud de micropigmentación y notas en valoraciones
ALTER TABLE henna_assessments
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'booking',
  ADD COLUMN IF NOT EXISTS notes TEXT;
