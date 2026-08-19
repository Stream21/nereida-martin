-- Existing clients are assumed to have done Perfilado (mantenimiento).
-- New clients keep the default false and declare it in the booking wizard.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS has_perfilado_history BOOLEAN NOT NULL DEFAULT false;
