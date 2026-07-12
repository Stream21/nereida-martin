/**
 * Crea la base de datos nere_studio si no existe (PostgreSQL nativo en Windows).
 * Uso: node scripts/db-bootstrap.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no definida en .env');
  process.exit(1);
}

const parsed = new URL(url.replace('postgresql://', 'http://'));
const dbName = parsed.pathname.replace(/^\//, '') || 'nere_studio';
const adminUrl = url.replace(`/${dbName}`, '/postgres');

async function main() {
  const pool = new Pool({ connectionString: adminUrl });

  try {
    const exists = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length > 0) {
      console.log(`Base de datos "${dbName}" ya existe.`);
      return;
    }

    await pool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Base de datos "${dbName}" creada.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
