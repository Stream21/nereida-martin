require('dotenv').config();
const calendarSync = require('../services/calendarSync');

async function main() {
  console.log('Sync incremental...');
  const sync = await calendarSync.syncIncremental();
  console.log(JSON.stringify(sync, null, 2));

  console.log('\nReconcile stale Google bookings...');
  const stale = await calendarSync.reconcileStaleGoogleBookings();
  console.log(JSON.stringify(stale, null, 2));

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
