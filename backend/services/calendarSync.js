const { query } = require('../db/pool');
const googleCalendar = require('./googleCalendar');
const emailService = require('./emailService');
const studioSettings = require('./studioSettings');
const {
  buildWebBookingSummary,
  buildWebBookingDescription,
} = require('../utils/webCalendarEvent');

const OPEN_HOUR = 10;
const CLOSE_HOUR = 20;
const ANTI_LOOP_MS = 30000;

function parseEventTimes(event) {
  if (event.recurrence && event.recurrence.length > 0) {
    return { skip: true, reason: 'recurring' };
  }

  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;

  if (!start || !end) {
    return { skip: true, reason: 'missing_times' };
  }

  if (event.start?.date && !event.start?.dateTime) {
    const dateStr = event.start.date;
    return {
      skip: false,
      startTime: new Date(`${dateStr}T${String(OPEN_HOUR).padStart(2, '0')}:00:00+02:00`),
      endTime: new Date(`${dateStr}T${String(CLOSE_HOUR).padStart(2, '0')}:00:00+02:00`),
      allDay: true,
    };
  }

  return {
    skip: false,
    startTime: new Date(start),
    endTime: new Date(end),
    allDay: false,
  };
}

function isCancelledEvent(event) {
  return event.status === 'cancelled';
}

function shouldSkipAntiLoop(booking) {
  if (booking.last_sync_source !== 'web') return false;
  if (!booking.updated_at) return false;
  const elapsed = Date.now() - new Date(booking.updated_at).getTime();
  return elapsed < ANTI_LOOP_MS;
}

async function getBookingByGoogleEventId(googleEventId) {
  const result = await query(
    'SELECT * FROM bookings WHERE google_event_id = $1',
    [googleEventId]
  );
  return result.rows[0] || null;
}

async function upsertFromGoogleEvent(event, { dryRun = false, forceSource = 'google_import' } = {}) {
  if (!event.id) return { action: 'skipped', reason: 'no_id' };

  const parsed = parseEventTimes(event);
  if (parsed.skip) {
    return { action: 'skipped', reason: parsed.reason, eventId: event.id };
  }

  const existing = await getBookingByGoogleEventId(event.id);
  const cancelled = isCancelledEvent(event);
  const googleUpdatedAt = event.updated ? new Date(event.updated) : null;

  if (existing && shouldSkipAntiLoop(existing)) {
    return { action: 'skipped', reason: 'anti_loop', eventId: event.id };
  }

  if (existing) {
    const timesChanged =
      new Date(existing.start_time).getTime() !== parsed.startTime.getTime() ||
      new Date(existing.end_time).getTime() !== parsed.endTime.getTime();
    const statusChanged =
      (cancelled && existing.status === 'confirmed') ||
      (!cancelled && existing.status === 'cancelled');

    if (!timesChanged && !statusChanged && existing.google_etag === event.etag) {
      return { action: 'unchanged', eventId: event.id, bookingId: existing.id };
    }

    if (dryRun) {
      return {
        action: cancelled ? 'would_cancel' : 'would_update',
        eventId: event.id,
        bookingId: existing.id,
      };
    }

    const newStatus = cancelled ? 'cancelled' : 'confirmed';

    await query(
      `UPDATE bookings SET
         start_time = $1,
         end_time = $2,
         status = $3,
         google_etag = $4,
         google_updated_at = $5,
         last_sync_source = 'google',
         updated_at = NOW()
       WHERE id = $6`,
      [
        parsed.startTime.toISOString(),
        parsed.endTime.toISOString(),
        newStatus,
        event.etag || null,
        googleUpdatedAt?.toISOString() || null,
        existing.id,
      ]
    );

    if (existing.source === 'web' && existing.client_id) {
      await notifyClientOfGoogleChange(existing.id, {
        type: cancelled ? 'cancelled' : timesChanged ? 'rescheduled' : 'updated',
        startTime: parsed.startTime,
        endTime: parsed.endTime,
      });
    }

    return {
      action: cancelled ? 'cancelled' : 'updated',
      eventId: event.id,
      bookingId: existing.id,
    };
  }

  if (cancelled) {
    return { action: 'skipped', reason: 'cancelled_new', eventId: event.id };
  }

  if (dryRun) {
    return { action: 'would_insert', eventId: event.id };
  }

  const clientId = await studioSettings.getImportedClientId();

  const inserted = await query(
    `INSERT INTO bookings (
       client_id, treatment_id, start_time, end_time, status, source,
       google_event_id, google_etag, google_updated_at, last_sync_source
     ) VALUES ($1, 'imported', $2, $3, 'confirmed', $4, $5, $6, $7, 'google')
     RETURNING id`,
    [
      clientId,
      parsed.startTime.toISOString(),
      parsed.endTime.toISOString(),
      forceSource,
      event.id,
      event.etag || null,
      googleUpdatedAt?.toISOString() || null,
    ]
  );

  return { action: 'inserted', eventId: event.id, bookingId: inserted.rows[0].id };
}

async function notifyClientOfGoogleChange(bookingId, { type, startTime, endTime }) {
  try {
    const result = await query(
      `SELECT b.start_time, b.end_time, c.name AS client_name, c.email AS client_email,
              t.name AS treatment_name, t.tag AS treatment_tag
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       LEFT JOIN treatments t ON b.treatment_id = t.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) return;

    const row = result.rows[0];
    if (row.client_email === studioSettings.IMPORTED_CLIENT_EMAIL) return;

    await emailService.sendGoogleChangeNotice({
      to: row.client_email,
      clientName: row.client_name,
      treatment: {
        name: row.treatment_name || 'Tu cita',
        tag: row.treatment_tag || '',
      },
      startTime: startTime || new Date(row.start_time),
      endTime: endTime || new Date(row.end_time),
      changeType: type,
    });
  } catch (err) {
    console.error(`Failed to notify client for booking ${bookingId}:`, err.message);
  }
}

async function cancelOrphanBookings(knownEventIds, { dryRun = false, timeMin } = {}) {
  const params = [knownEventIds.length > 0 ? knownEventIds : ['__none__']];
  let sql = `
    SELECT id, google_event_id, source FROM bookings
    WHERE google_event_id IS NOT NULL
      AND status = 'confirmed'
      AND google_event_id != ALL($1::varchar[])`;

  if (timeMin) {
    params.push(timeMin);
    sql += ' AND start_time >= $2';
  }

  const orphans = await query(sql, params);
  const results = [];

  for (const row of orphans.rows) {
    if (dryRun) {
      results.push({ action: 'would_cancel_orphan', bookingId: row.id, eventId: row.google_event_id });
      continue;
    }

    await query(
      `UPDATE bookings SET status = 'cancelled', last_sync_source = 'google', updated_at = NOW()
       WHERE id = $1`,
      [row.id]
    );

    if (row.source === 'web') {
      await notifyClientOfGoogleChange(row.id, { type: 'cancelled' });
    }

    results.push({ action: 'cancelled_orphan', bookingId: row.id, eventId: row.google_event_id });
  }

  return results;
}

async function importEventsFromGoogle({ timeMin, timeMax, dryRun = false } = {}) {
  const min = timeMin || new Date().toISOString();
  const max =
    timeMax ||
    new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  const { events, nextSyncToken } = await googleCalendar.listEvents({
    timeMin: min,
    timeMax: max,
    showDeleted: true,
  });

  const stats = { inserted: 0, updated: 0, cancelled: 0, skipped: 0, unchanged: 0 };
  const knownEventIds = [];

  for (const event of events) {
    knownEventIds.push(event.id);
    const result = await upsertFromGoogleEvent(event, { dryRun, forceSource: 'google_import' });

    if (result.action === 'inserted' || result.action === 'would_insert') stats.inserted++;
    else if (result.action === 'updated' || result.action === 'would_update') stats.updated++;
    else if (result.action === 'cancelled' || result.action === 'would_cancel') stats.cancelled++;
    else if (result.action === 'unchanged') stats.unchanged++;
    else stats.skipped++;
  }

  const orphanResults = await cancelOrphanBookings(knownEventIds, { dryRun, timeMin: min });
  stats.orphansCancelled = orphanResults.length;

  if (!dryRun && nextSyncToken) {
    await studioSettings.updateSyncToken(nextSyncToken);
  }

  return { stats, totalEvents: events.length, orphanResults };
}

async function syncIncremental({ dryRun = false } = {}) {
  const syncToken = await studioSettings.getSyncToken();

  if (!syncToken) {
    return importEventsFromGoogle({ dryRun });
  }

  try {
    const { events, nextSyncToken } = await googleCalendar.listEvents({
      syncToken,
      showDeleted: true,
    });

    const stats = { inserted: 0, updated: 0, cancelled: 0, skipped: 0, unchanged: 0 };

    for (const event of events) {
      const result = await upsertFromGoogleEvent(event, { dryRun, forceSource: 'google_sync' });

      if (result.action === 'inserted' || result.action === 'would_insert') stats.inserted++;
      else if (result.action === 'updated' || result.action === 'would_update') stats.updated++;
      else if (result.action === 'cancelled' || result.action === 'would_cancel') stats.cancelled++;
      else if (result.action === 'unchanged') stats.unchanged++;
      else stats.skipped++;
    }

    if (!dryRun && nextSyncToken) {
      await studioSettings.updateSyncToken(nextSyncToken);
    }

    return { stats, totalEvents: events.length, mode: 'incremental' };
  } catch (err) {
    if (err.code === 410 || err.message?.includes('Sync token is no longer valid')) {
      console.warn('Sync token expired, performing full re-import');
      await studioSettings.updateSyncToken(null);
      return importEventsFromGoogle({ dryRun });
    }
    throw err;
  }
}

async function reconcilePendingGoogleDeletes() {
  const result = await query(
    `SELECT id, google_event_id FROM bookings
     WHERE sync_pending = true AND google_event_id IS NOT NULL AND status = 'cancelled'`
  );

  for (const row of result.rows) {
    try {
      await googleCalendar.deleteEvent(row.google_event_id);
      await query('UPDATE bookings SET sync_pending = false WHERE id = $1', [row.id]);
    } catch (err) {
      if (err.code === 404 || err.message?.includes('Not Found')) {
        await query('UPDATE bookings SET sync_pending = false WHERE id = $1', [row.id]);
      } else {
        console.error(`Retry delete failed for booking ${row.id}:`, err.message);
      }
    }
  }
}

async function reconcileMissingGoogleEvents() {
  const result = await query(
    `SELECT b.id, b.start_time, b.end_time, b.google_event_id,
            c.name AS client_name, c.email AS client_email,
            t.name AS treatment_name, t.tag AS treatment_tag
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE b.status = 'confirmed'
       AND b.source = 'web'
       AND b.google_event_id IS NULL
       AND b.start_time > NOW()`
  );

  for (const row of result.rows) {
    try {
      const event = await googleCalendar.createEvent({
        summary: buildWebBookingSummary(row.treatment_name || 'Cita', row.client_name),
        description: buildWebBookingDescription({
          treatmentName: row.treatment_name || 'Cita',
          treatmentTag: row.treatment_tag || '',
          clientName: row.client_name,
          clientEmail: row.client_email,
          bookingId: row.id,
        }),
        startTime: new Date(row.start_time).toISOString(),
        endTime: new Date(row.end_time).toISOString(),
        clientEmail: row.client_email !== studioSettings.IMPORTED_CLIENT_EMAIL ? row.client_email : null,
        isWebBooking: true,
        bookingId: row.id,
      });

      await query(
        `UPDATE bookings SET google_event_id = $1, google_etag = $2, google_updated_at = $3,
         last_sync_source = 'web', updated_at = NOW()
         WHERE id = $4`,
        [event.id, event.etag || null, event.updated ? new Date(event.updated).toISOString() : null, row.id]
      );
    } catch (err) {
      console.error(`Failed to create missing Google event for booking ${row.id}:`, err.message);
    }
  }
}

async function ensureWatchChannel() {
  const webhookUrl =
    process.env.GOOGLE_WEBHOOK_URL ||
    (process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL.replace(/\/$/, '')}/api/webhooks/google-calendar`
      : null);
  if (!webhookUrl) {
    console.warn('GOOGLE_WEBHOOK_URL not set — calendar push notifications disabled');
    return null;
  }

  const existing = await studioSettings.getWatchChannel();
  const now = Date.now();
  const expirationMs = existing.expiration ? new Date(existing.expiration).getTime() : 0;
  const renewThreshold = 24 * 60 * 60 * 1000;

  if (existing.channelId && existing.resourceId && expirationMs - now > renewThreshold) {
    return existing;
  }

  if (existing.channelId && existing.resourceId) {
    try {
      await googleCalendar.stopWatch(existing.channelId, existing.resourceId);
    } catch {
      // channel may already be expired
    }
  }

  const channel = await googleCalendar.watchCalendar(webhookUrl);
  await studioSettings.saveWatchChannel(channel);
  return channel;
}

module.exports = {
  importEventsFromGoogle,
  syncIncremental,
  upsertFromGoogleEvent,
  cancelOrphanBookings,
  reconcilePendingGoogleDeletes,
  reconcileMissingGoogleEvents,
  ensureWatchChannel,
  parseEventTimes,
};
