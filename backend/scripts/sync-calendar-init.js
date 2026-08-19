#!/usr/bin/env node
/**
 * Importación inicial / anual de citas desde Google Calendar → BD.
 *
 * Uso local:
 *   npm run calendar:init:year
 *   npm run calendar:init -- --from=2026-01-01 --to=2026-12-31
 *   npm run calendar:init -- --year=2026 --dry-run
 *
 * En Render (One-off Job o Shell del web service):
 *   cd backend && node scripts/sync-calendar-init.js --year=2026
 *
 * Requiere: DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID
 */
require('dotenv').config();

const calendarSync = require('../services/calendarSync');
const studioSettings = require('../services/studioSettings');

function parseArgs(argv) {
  const options = { dryRun: false, from: null, to: null, year: null };

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--year') options.year = String(new Date().getFullYear());
    else if (arg.startsWith('--year=')) options.year = arg.split('=')[1];
    else if (arg.startsWith('--from=')) options.from = arg.split('=')[1];
    else if (arg.startsWith('--to=')) options.to = arg.split('=')[1];
  }

  if (options.year) {
    const y = Number(options.year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      throw new Error(`Año inválido: ${options.year}`);
    }
    options.from = options.from || `${y}-01-01`;
    options.to = options.to || `${y}-12-31`;
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('Nereida Martín Studio — Calendar init sync');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);

  await studioSettings.ensureBookingStartDateFromEnv();

  const timeMin = options.from
    ? new Date(`${options.from}T00:00:00`).toISOString()
    : new Date().toISOString();

  const timeMax = options.to
    ? new Date(`${options.to}T23:59:59`).toISOString()
    : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`Range: ${timeMin} → ${timeMax}`);

  const result = await calendarSync.importEventsFromGoogle({
    timeMin,
    timeMax,
    dryRun: options.dryRun,
  });

  console.log('\nResults:');
  console.log(`  Events fetched: ${result.totalEvents}`);
  console.log(`  Inserted:       ${result.stats.inserted}`);
  console.log(`  Updated:        ${result.stats.updated}`);
  console.log(`  Cancelled:      ${result.stats.cancelled}`);
  console.log(`  Unchanged:      ${result.stats.unchanged}`);
  console.log(`  Skipped:        ${result.stats.skipped}`);
  console.log(`  Fantasma skip:  ${result.stats.fantasmaSkipped || result.stats.overlapSkipped || 0}`);
  console.log(`  Overlap insert: ${result.stats.insertedOverlap || 0}`);
  console.log(`  [Bloqueo] skip: ${result.stats.ghostSkipped || 0}`);
  console.log(`  Orphans:        ${result.stats.orphansCancelled}`);

  if (options.dryRun) {
    console.log('\nDry run complete — no changes written.');
  } else {
    console.log('\nSync token saved for incremental updates.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Calendar init failed:', err.message);
  process.exit(1);
});
