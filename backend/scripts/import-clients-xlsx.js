/**
 * Importa clientas desde un Excel (nombre + teléfono).
 * Uso:
 *   node scripts/import-clients-xlsx.js --file "C:\path\CLIENTES.xlsx"
 *   node scripts/import-clients-xlsx.js --file "...\CLIENTES.xlsx" --apply
 *
 * Sin --apply hace dry-run (no escribe en BD).
 */
require('dotenv').config();
const path = require('path');
const { parseXlsxFile, upsertClientRows } = require('../services/clientImportService');

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const apply = args.includes('--apply');
  const filePath =
    (fileIdx >= 0 && args[fileIdx + 1]) ||
    path.join(process.env.USERPROFILE || '', 'Downloads', 'CLIENTES.xlsx');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no definida');
    process.exit(1);
  }

  console.log(`Archivo: ${filePath}`);
  console.log(`Modo: ${apply ? 'APPLY (escribe BD)' : 'DRY-RUN'}`);

  const rows = await parseXlsxFile(filePath);
  console.log(`Filas leídas: ${rows.length}`);

  const summary = await upsertClientRows(rows, { dryRun: !apply });
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log('\nVuelve a ejecutar con --apply para guardar.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
