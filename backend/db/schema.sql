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
  email VARCHAR(200) NOT NULL UNIQUE,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  treatment_id VARCHAR(50) REFERENCES treatments(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed',
  google_event_id VARCHAR(200),
  reminder_sent BOOLEAN DEFAULT false,
  confirmation_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_reminder ON bookings(reminder_sent, start_time) WHERE status = 'confirmed';
