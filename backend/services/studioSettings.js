const { query } = require('../db/pool');

const IMPORTED_CLIENT_EMAIL = 'imported@studio.local';

async function getStudioSettings() {
  const result = await query('SELECT * FROM studio_settings WHERE id = 1');
  if (result.rows.length === 0) {
    const bookingStartDate = process.env.BOOKING_START_DATE || new Date().toISOString().split('T')[0];
    await query(
      'INSERT INTO studio_settings (id, booking_start_date) VALUES (1, $1) ON CONFLICT (id) DO NOTHING',
      [bookingStartDate]
    );
    return { booking_start_date: bookingStartDate };
  }
  return result.rows[0];
}

async function getBookingStartDate() {
  const envDate = process.env.BOOKING_START_DATE;
  if (envDate) return envDate;

  const settings = await getStudioSettings();
  if (settings.booking_start_date) {
    const d = settings.booking_start_date;
    return d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

async function updateSyncToken(syncToken) {
  await query(
    'UPDATE studio_settings SET google_sync_token = $1, updated_at = NOW() WHERE id = 1',
    [syncToken]
  );
}

async function getSyncToken() {
  const settings = await getStudioSettings();
  return settings.google_sync_token || null;
}

async function saveWatchChannel({ channelId, resourceId, expiration }) {
  await query(
    `UPDATE studio_settings SET
       google_channel_id = $1,
       google_resource_id = $2,
       google_channel_expiration = $3,
       updated_at = NOW()
     WHERE id = 1`,
    [channelId, resourceId, expiration ? new Date(Number(expiration)).toISOString() : null]
  );
}

async function getWatchChannel() {
  const settings = await getStudioSettings();
  return {
    channelId: settings.google_channel_id,
    resourceId: settings.google_resource_id,
    expiration: settings.google_channel_expiration,
  };
}

async function clearWatchChannel() {
  await query(
    `UPDATE studio_settings SET
       google_channel_id = NULL,
       google_resource_id = NULL,
       google_channel_expiration = NULL,
       updated_at = NOW()
     WHERE id = 1`
  );
}

async function getImportedClientId() {
  const result = await query('SELECT id FROM clients WHERE email = $1', [IMPORTED_CLIENT_EMAIL]);
  if (result.rows.length > 0) return result.rows[0].id;

  const inserted = await query(
    'INSERT INTO clients (name, email) VALUES ($1, $2) RETURNING id',
    ['Importado Google', IMPORTED_CLIENT_EMAIL]
  );
  return inserted.rows[0].id;
}

async function ensureBookingStartDateFromEnv() {
  const envDate = process.env.BOOKING_START_DATE;
  if (!envDate) return;

  await query(
    `INSERT INTO studio_settings (id, booking_start_date) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET booking_start_date = EXCLUDED.booking_start_date, updated_at = NOW()`,
    [envDate]
  );
}

module.exports = {
  getBookingStartDate,
  getStudioSettings,
  updateSyncToken,
  getSyncToken,
  saveWatchChannel,
  getWatchChannel,
  clearWatchChannel,
  getImportedClientId,
  ensureBookingStartDateFromEnv,
  IMPORTED_CLIENT_EMAIL,
};
