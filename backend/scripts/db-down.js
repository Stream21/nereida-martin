/**
 * Para el contenedor PostgreSQL (los datos permanecen en el volumen).
 * Uso: npm run db:down
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const wslRoot = execSync(`wsl wslpath -a "${root}"`, { encoding: 'utf8' }).trim();

execSync(`wsl -e bash -lc ${JSON.stringify(`cd '${wslRoot}' && docker-compose down`)}`, {
  stdio: 'inherit',
});

console.log('Contenedor detenido. Datos conservados en volumen nere_pg_data.');
