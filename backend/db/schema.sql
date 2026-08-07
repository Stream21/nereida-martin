CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE treatments (
  id VARCHAR(50) PRIMARY KEY,
  category VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  tag VARCHAR(200),
  duration_min INTEGER NOT NULL,
  duration_max INTEGER,
  price DECIMAL(8,2),
  active BOOLEAN DEFAULT true
);

CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200),
  phone VARCHAR(20),
  phone_normalized VARCHAR(20),
  password_hash VARCHAR(255),
  account_status VARCHAR(20) NOT NULL DEFAULT 'invited',
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX clients_email_unique ON clients (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX clients_phone_normalized_unique ON clients (phone_normalized) WHERE phone_normalized IS NOT NULL;

CREATE TABLE client_invites (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_invites_client ON client_invites(client_id);
CREATE INDEX idx_client_invites_token ON client_invites(token);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  treatment_id VARCHAR(50) REFERENCES treatments(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed',
  source VARCHAR(20) DEFAULT 'web',
  cancel_token UUID UNIQUE,
  google_event_id VARCHAR(200) UNIQUE,
  google_etag VARCHAR(200),
  google_updated_at TIMESTAMPTZ,
  last_sync_source VARCHAR(20),
  sync_pending BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  confirmation_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_reminder ON bookings(reminder_sent, start_time) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_google_event_id ON bookings(google_event_id) WHERE google_event_id IS NOT NULL;
CREATE INDEX idx_bookings_cancel_token ON bookings(cancel_token) WHERE cancel_token IS NOT NULL;

CREATE TABLE studio_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  booking_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  google_sync_token TEXT,
  google_channel_id VARCHAR(200),
  google_resource_id VARCHAR(200),
  google_channel_expiration TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO studio_settings (id, booking_start_date) VALUES (1, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;
