-- Run on existing databases: psql $DATABASE_URL -f db/migration_calendar_sync.sql

ALTER TABLE bookings ALTER COLUMN treatment_id DROP NOT NULL;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_token UUID UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_etag VARCHAR(200);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_updated_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_sync_source VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sync_pending BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_google_event_id
  ON bookings(google_event_id) WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_cancel_token
  ON bookings(cancel_token) WHERE cancel_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS studio_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  booking_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  google_sync_token TEXT,
  google_channel_id VARCHAR(200),
  google_resource_id VARCHAR(200),
  google_channel_expiration TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO studio_settings (id, booking_start_date)
VALUES (1, COALESCE(NULLIF(current_setting('app.booking_start_date', true), '')::date, CURRENT_DATE))
ON CONFLICT (id) DO NOTHING;

INSERT INTO treatments (id, category, name, tag, duration_min, duration_max, active)
VALUES ('imported', 'general', 'Cita importada', 'Importada desde Google Calendar', 60, 120, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (name, email)
VALUES ('Importado Google', 'imported@studio.local')
ON CONFLICT (email) DO NOTHING;

UPDATE studio_settings
SET booking_start_date = COALESCE(
  NULLIF(current_setting('app.booking_start_date', true), '')::date,
  booking_start_date
)
WHERE id = 1;
