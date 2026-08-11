-- Notas internas en ficha de cliente (panel Studio).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS notes TEXT;
