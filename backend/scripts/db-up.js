/**
 * Arranca PostgreSQL en Docker (WSL) e inicializa la BD.
 * Uso: npm run db:up
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const wslRoot = execSync(`wsl wslpath -a "${root}"`, { encoding: 'utf8' }).trim();

function wsl(cmd) {
  execSync(`wsl -e bash -lc ${JSON.stringify(cmd)}`, { stdio: 'inherit' });
}

console.log('>> Docker (WSL): arrancando PostgreSQL...');
wsl(
  `cd '${wslRoot}' && (docker start nere-postgres 2>/dev/null || docker-compose up -d)`
);

console.log('>> Esperando PostgreSQL...');
for (let i = 0; i < 30; i++) {
  try {
    execSync(
      `wsl -e bash -lc ${JSON.stringify(`cd '${wslRoot}' && docker-compose exec -T db pg_isready -U postgres -d nere_studio`)}`,
      { stdio: 'ignore' }
    );
    break;
  } catch {
    if (i === 29) {
      console.error('Timeout esperando PostgreSQL.');
      process.exit(1);
    }
    execSync('powershell -Command "Start-Sleep -Seconds 2"', { stdio: 'ignore' });
  }
}

console.log('>> Inicializando esquema y datos...');
execSync('node scripts/db-init.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

console.log('\nBD lista: localhost:5433/nere_studio (volumen nere_pg_data)');
