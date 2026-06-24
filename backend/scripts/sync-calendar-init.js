#!/usr/bin/env node
require('dotenv').config();

const calendarSync = require('../services/calendarSync');
const studioSettings = require('../services/studioSettings');

function parseArgs(argv) {
  const options = { dryRun: false, from: null, to: null };

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--from=')) options.from = arg.split('=')[1];
    else if (arg.startsWith('--to=')) options.to = arg.split('=')[1];
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('Studio Anuelblingding — Calendar init sync');
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
