/**
 * Inicializa tablas, migraciones y datos base (idempotente).
 * Uso: npm run db:init
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_DIR = path.join(__dirname, '..', 'db');

async function runFile(pool, filename) {
  const filePath = path.join(DB_DIR, filename);
  if (!fs.existsSync(filePath)) return;
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
  console.log(`  ✓ ${filename}`);
}

async function tableExists(pool, name) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return r.rows.length > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no definida en backend/.env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query('SELECT 1');
    console.log('Conectado a PostgreSQL.');
    console.log(`URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);

    const hasSchema = await tableExists(pool, 'treatments');

    if (!hasSchema) {
      console.log('Creando esquema inicial...');
      await runFile(pool, 'schema.sql');
    } else {
      console.log('Esquema existente — aplicando migraciones...');
    }

    await runFile(pool, 'migration_calendar_sync.sql');
    await runFile(pool, 'migration_treatments_prices.sql');
    await runFile(pool, 'migration_client_experience.sql');
    await runFile(pool, 'migration_owner_dashboard.sql');
    await runFile(pool, 'migration_intake_signature.sql');
    await runFile(pool, 'migration_client_auth.sql');
    await runFile(pool, 'seed.sql');

    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM treatments WHERE active = true) AS treatments,
        (SELECT COUNT(*)::int FROM bookings WHERE status = 'confirmed') AS bookings_active,
        (SELECT COUNT(*)::int FROM clients) AS clients
    `);
    console.log('\nEstado:', counts.rows[0]);
    console.log('Base de datos lista.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
