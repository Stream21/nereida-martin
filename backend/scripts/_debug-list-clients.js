// Force prod DB — do not load local .env
process.env.DATABASE_URL =
  'postgresql://nere:hhfNytqWgSGmiuzOKlb31KqgEiDHgeLr@dpg-d9r6gqfavr4c738h3tmg-a.frankfurt-postgres.render.com/nere_studio?sslmode=require';

const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const sql = `
    SELECT
       c.id,
       c.name,
       c.email,
       c.phone,
       c.phone_normalized,
       c.account_status,
       c.created_at,
       c.registered_at,
       c.first_booking_at,
       COUNT(b.id) FILTER (
         WHERE b.status IN ('confirmed', 'pending_review')
       )::int AS booking_count,
       COALESCE(
         SUM(t.price) FILTER (
           WHERE b.status IN ('confirmed', 'pending_review') AND t.price IS NOT NULL
         ),
         0
       )::numeric AS total_spent,
       MAX(b.start_time) FILTER (
         WHERE b.status IN ('confirmed', 'pending_review')
       ) AS last_booking_at,
       (
         SELECT i.expires_at
         FROM client_invites i
         WHERE i.client_id = c.id AND i.used_at IS NULL
         ORDER BY i.created_at DESC
         LIMIT 1
       ) AS invite_expires_at,
       EXISTS (
         SELECT 1 FROM client_invites i
         WHERE i.client_id = c.id AND i.used_at IS NULL AND i.expires_at > NOW()
       ) AS has_invite
     FROM clients c
     LEFT JOIN bookings b ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     GROUP BY c.id
     ORDER BY last_booking_at DESC NULLS LAST, c.name ASC
     LIMIT 100 OFFSET 0`;

  try {
    const r = await pool.query(sql);
    console.log('SQL OK rows=', r.rows.length);
  } catch (err) {
    console.error('SQL FAIL:', err.message);
    console.error(err);
    process.exitCode = 1;
  }

  // Also test via service module (pool.js reads env at load)
  try {
    delete require.cache[require.resolve('../db/pool')];
    delete require.cache[require.resolve('../services/ownerDashboardService')];
    const dashboard = require('../services/ownerDashboardService');
    const data = await dashboard.listClients({ page: 1, limit: 100 });
    console.log('service OK total=', data.total);
  } catch (err) {
    console.error('service FAIL:', err.message);
    process.exitCode = 1;
  }

  await pool.end();
}

main();
