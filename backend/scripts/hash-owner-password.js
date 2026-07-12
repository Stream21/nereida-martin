/**
 * Genera hash bcrypt para OWNER_DASHBOARD_PASSWORD_HASH
 * Uso: node scripts/hash-owner-password.js "tu-contraseña"
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/hash-owner-password.js "tu-contraseña"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nAñade esto a backend/.env:\n');
console.log(`OWNER_DASHBOARD_PASSWORD_HASH=${hash}\n`);
