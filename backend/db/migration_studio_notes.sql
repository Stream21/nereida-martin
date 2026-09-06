-- Historial de notas de Studio: sobre la clienta o ligadas a una cita.
CREATE TABLE IF NOT EXISTS studio_notes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_studio_notes_client_created
  ON studio_notes (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_notes_booking
  ON studio_notes (booking_id)
  WHERE booking_id IS NOT NULL;

-- Copia el texto único de ficha como primera entrada de clienta (idempotente).
INSERT INTO studio_notes (client_id, body, created_at)
SELECT c.id, TRIM(c.notes), NOW()
FROM clients c
WHERE c.notes IS NOT NULL
  AND TRIM(c.notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM studio_notes sn
    WHERE sn.client_id = c.id
      AND sn.booking_id IS NULL
      AND sn.body = TRIM(c.notes)
  );
