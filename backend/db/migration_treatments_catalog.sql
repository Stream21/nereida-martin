-- Catalog admin: display order for treatments (owner-managed)

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100;

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS owner_only BOOLEAN NOT NULL DEFAULT false;

-- Backfill current public / wizard order (matches previous CASE + browDesign)
UPDATE treatments SET display_order = 10  WHERE id = 'brow-design-primera';
UPDATE treatments SET display_order = 20  WHERE id = 'brow-design-seguimiento';
UPDATE treatments SET display_order = 30  WHERE id = 'perfilado-conjunto';
UPDATE treatments SET display_order = 40  WHERE id = 'brow-define';
UPDATE treatments SET display_order = 50  WHERE id = 'brow-lami';
UPDATE treatments SET display_order = 60  WHERE id = 'brow-lami-define';
UPDATE treatments SET display_order = 70  WHERE id = 'brow-henna';
UPDATE treatments SET display_order = 80  WHERE id = 'brow-restored';
UPDATE treatments SET display_order = 90  WHERE id = 'micropigmentacion-soft-pixel';
UPDATE treatments SET display_order = 100 WHERE id = 'nanoblading';
UPDATE treatments SET display_order = 110 WHERE id = 'lash-lift-korean';
UPDATE treatments SET display_order = 120 WHERE id = 'skin-reset';
UPDATE treatments SET display_order = 130 WHERE id = 'ritual-glow';
UPDATE treatments SET display_order = 140 WHERE id = 'skin-boost';
UPDATE treatments SET display_order = 150 WHERE id = 'labio-superior';
UPDATE treatments SET display_order = 160 WHERE id = 'depilacion-facial';
UPDATE treatments SET display_order = 170 WHERE id = 'smile-gem';
UPDATE treatments SET display_order = 180 WHERE id = 'perfilado-grupo';
UPDATE treatments SET display_order = 900 WHERE id = 'imported';

CREATE INDEX IF NOT EXISTS idx_treatments_display_order
  ON treatments (display_order, id);

COMMENT ON COLUMN treatments.display_order IS
  'Lower values appear first in public booking and owner catalog.';
