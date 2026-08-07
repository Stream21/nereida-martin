const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || '';

/** Render Postgres requires SSL (internal and external URLs). */
function shouldUseSsl(url) {
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return true;
  if (process.env.PGSSLMODE === 'disable') return false;
  if (process.env.RENDER === 'true') return true;
  if (/\.render\.com/i.test(url)) return true;
  if (/sslmode=require/i.test(url)) return true;
  return false;
}

const pool = new Pool({
  connectionString: connectionString || undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(shouldUseSsl(connectionString)
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
