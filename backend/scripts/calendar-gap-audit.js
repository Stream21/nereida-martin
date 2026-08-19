#!/usr/bin/env node
/**
 * Compare Google Calendar events vs bookings in DB.
 *
 * Usage:
 *   node scripts/calendar-gap-audit.js
 *   node scripts/calendar-gap-audit.js --from=2026-08-01 --to=2027-01-31
 *   node scripts/calendar-gap-audit.js --search=Zaira
 */

require('dotenv').config();

const { query, pool } = require('../db/pool');
const googleCalendar = require('../services/googleCalendar');
const { parseEventTimes, upsertFromGoogleEvent } = require('../services/calendarSync');
const { normalizeImportedEventTimes } = require('../utils/importedEventTimes');
const { isGhostBlockEvent } = require('../utils/ghostCalendarEvent');
const { isWebBookingEvent } = require('../utils/webCalendarEvent');
const { formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');
const studioSettings = require('../services/studioSettings');

function parseArgs(argv) {
  const options = {
    from: '2026-08-01',
    to: '2027-01-31',
    search: 'Zaira',
  };

  for (const arg of argv) {
    if (arg.startsWith('--from=')) options.from = arg.split('=')[1];
    else if (arg.startsWith('--to=')) options.to = arg.split('=')[1];
    else if (arg.startsWith('--search=')) options.search = arg.split('=')[1];
  }

  return options;
}

function fmt(date) {
  return `${formatStudioDate(date)} ${formatStudioTime(date)}`;
}

function classifyEvent(event) {
  if (event.status === 'cancelled') return 'cancelled';
  if (isGhostBlockEvent(event)) return 'ghost_block';
  if (isWebBookingEvent(event)) return 'web';
  const parsed = parseEventTimes(event);
  if (parsed.skip) return parsed.reason;
  return 'importable';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const timeMin = new Date(`${options.from}T00:00:00`).toISOString();
  const timeMax = new Date(`${options.to}T23:59:59`).toISOString();

  console.log('\n=== Calendar gap audit (Google vs DB) ===\n');
  console.log(`Calendar: ${googleCalendar.getCalendarId()}`);
  console.log(`DB:       ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':***@') : '(none)'}`);
  console.log(`Range:    ${options.from} → ${options.to}`);
  console.log(`Search:   ${options.search || '(none)'}\n`);

  const dbProbe = await query(
    `SELECT current_database() AS db, COUNT(*)::int AS bookings,
            MIN(start_time) AS min_start, MAX(start_time) AS max_start
     FROM bookings`
  );
  const settings = await query(
    `SELECT google_sync_token IS NOT NULL AS has_sync_token,
            google_channel_id, google_channel_expiration, updated_at,
            booking_start_date
     FROM studio_settings WHERE id = 1`
  );

  console.log('── Database ──');
  console.log(`  database:          ${dbProbe.rows[0].db}`);
  console.log(`  bookings total:    ${dbProbe.rows[0].bookings}`);
  console.log(`  bookings span:     ${dbProbe.rows[0].min_start || '-'} → ${dbProbe.rows[0].max_start || '-'}`);
  if (settings.rows[0]) {
    const s = settings.rows[0];
    console.log(`  booking_start:     ${s.booking_start_date}`);
    console.log(`  has_sync_token:    ${s.has_sync_token}`);
    console.log(`  watch_channel:     ${s.google_channel_id ? 'yes' : 'NO'}`);
    console.log(`  watch_expiration:  ${s.google_channel_expiration || '-'}`);
    console.log(`  settings updated:  ${s.updated_at || '-'}`);
  }
  console.log('');

  const { events } = await googleCalendar.listEvents({
    timeMin,
    timeMax,
    showDeleted: true,
  });

  const bookings = await query(
    `SELECT b.id, b.status, b.source, b.google_event_id, b.start_time, b.end_time,
            b.treatment_id, b.created_at, b.updated_at, b.last_sync_source,
            c.name AS client_name
     FROM bookings b
     LEFT JOIN clients c ON c.id = b.client_id
     WHERE b.start_time < $2 AND b.end_time > $1`,
    [timeMin, timeMax]
  );

  const byGoogleId = new Map();
  for (const row of bookings.rows) {
    if (row.google_event_id) byGoogleId.set(row.google_event_id, row);
  }

  const occupiedRanges = bookings.rows
    .filter((row) => ['confirmed', 'pending_review', 'pending_companion'].includes(row.status))
    .map((row) => ({
      start: new Date(row.start_time).getTime(),
      end: new Date(row.end_time).getTime(),
    }));

  const counts = {
    googleRaw: events.length,
    cancelled: 0,
    ghost: 0,
    skippedParse: 0,
    importable: 0,
    inDbConfirmed: 0,
    inDbOther: 0,
    missingFromDb: 0,
  };

  const missing = [];
  const searchHits = [];
  const skipReasons = {};

  for (const event of events) {
    const summary = event.summary || '(sin título)';
    const parsed = parseEventTimes(event);
    const kind = classifyEvent(event);
    const dbRow = byGoogleId.get(event.id);

    if (options.search && summary.toLowerCase().includes(options.search.toLowerCase())) {
      searchHits.push({ event, parsed, kind, dbRow });
    }

    if (kind === 'cancelled') {
      counts.cancelled++;
      continue;
    }
    if (kind === 'ghost_block') {
      counts.ghost++;
      continue;
    }
    if (parsed.skip) {
      counts.skippedParse++;
      skipReasons[parsed.reason] = (skipReasons[parsed.reason] || 0) + 1;
      continue;
    }

    counts.importable++;

    if (dbRow) {
      if (['confirmed', 'pending_review', 'pending_companion', 'google_overlap'].includes(dbRow.status)) {
        counts.inDbConfirmed++;
      } else {
        counts.inDbOther++;
        missing.push({ event, parsed, kind, dbRow, note: `in_db_status_${dbRow.status}` });
      }
      continue;
    }

    counts.missingFromDb++;
    missing.push({ event, parsed, kind, dbRow: null, note: 'not_in_db' });
  }

  console.log('── Google vs DB ──');
  console.log(`  Google events (incl. deleted): ${counts.googleRaw}`);
  console.log(`  Cancelled in Google:           ${counts.cancelled}`);
  console.log(`  [Bloqueo] ghosts:              ${counts.ghost}`);
  console.log(`  Skipped by parser:             ${counts.skippedParse}`, skipReasons);
  console.log(`  Importable:                    ${counts.importable}`);
  console.log(`  Present in DB (active):        ${counts.inDbConfirmed}`);
  console.log(`  Present in DB (other status):  ${counts.inDbOther}`);
  console.log(`  MISSING from DB:               ${counts.missingFromDb}\n`);

  if (searchHits.length > 0) {
    console.log(`── Search "${options.search}" (${searchHits.length}) ──\n`);
    for (const hit of searchHits) {
      const { event, parsed, kind, dbRow } = hit;
      console.log(`  summary:     ${event.summary}`);
      console.log(`  eventId:     ${event.id}`);
      console.log(`  status:      ${event.status}`);
      console.log(`  kind:        ${kind}`);
      console.log(`  created:     ${event.created || '-'}`);
      console.log(`  updated:     ${event.updated || '-'}`);
      console.log(`  htmlLink:    ${event.htmlLink || '-'}`);
      console.log(`  transparency:${event.transparency || 'opaque'}`);
      console.log(`  calendarId:  ${googleCalendar.getCalendarId()}`);
      if (!parsed.skip) {
        const norm = normalizeImportedEventTimes(parsed.startTime, parsed.endTime);
        console.log(`  google:      ${fmt(parsed.startTime)} → ${fmt(parsed.endTime)}`);
        console.log(`  normalized:  ${fmt(norm.startTime)} → ${fmt(norm.endTime)}`);
      } else {
        console.log(`  parse skip:  ${parsed.reason}`);
      }
      if (dbRow) {
        console.log(`  DB booking:  #${dbRow.id} ${dbRow.status} ${dbRow.source} ${dbRow.client_name}`);
        console.log(`               ${fmt(new Date(dbRow.start_time))} → ${fmt(new Date(dbRow.end_time))}`);
      } else {
        console.log('  DB booking:  NOT FOUND');
      }
      console.log('');
    }
  } else if (options.search) {
    console.log(`── Search "${options.search}" — no Google events matched ──\n`);
  }

  const day28 = missing.filter((row) => {
    if (row.parsed.skip) return false;
    const d = formatStudioDate(row.parsed.startTime);
    return d.endsWith('-28');
  });

  if (day28.length > 0) {
    console.log(`── Missing events on any day 28 (${day28.length}) ──\n`);
    for (const row of day28) {
      const norm = normalizeImportedEventTimes(row.parsed.startTime, row.parsed.endTime);
      console.log(`  ${fmt(norm.startTime)} → ${fmt(norm.endTime)}  [${row.kind}]  "${row.event.summary}"  (${row.note})`);
    }
    console.log('');
  }

  console.log(`── Missing importable events (${missing.length}) — dry-run upsert ──\n`);

  const reasonTally = {};
  for (const row of missing) {
    const dry = await upsertFromGoogleEvent(row.event, {
      dryRun: true,
      occupiedRanges,
    });
    const reason = dry.reason || dry.action;
    reasonTally[reason] = (reasonTally[reason] || 0) + 1;
    row.dry = dry;

    const times = row.parsed.skip
      ? '-'
      : `${fmt(normalizeImportedEventTimes(row.parsed.startTime, row.parsed.endTime).startTime)} → ${fmt(normalizeImportedEventTimes(row.parsed.startTime, row.parsed.endTime).endTime)}`;

    const overlapWith = [];
    if (!row.parsed.skip) {
      const norm = normalizeImportedEventTimes(row.parsed.startTime, row.parsed.endTime);
      const start = norm.startTime.getTime();
      const end = norm.endTime.getTime();
      for (const b of bookings.rows) {
        if (!['confirmed', 'pending_review', 'pending_companion'].includes(b.status)) continue;
        const bs = new Date(b.start_time).getTime();
        const be = new Date(b.end_time).getTime();
        if (start < be && bs < end) {
          overlapWith.push(
            `#${b.id} ${fmt(new Date(b.start_time))} ${b.client_name || ''} ${b.source} ${b.treatment_id}`
          );
        }
      }
    }

    console.log(`  ${times}`);
    console.log(`    "${row.event.summary}"`);
    console.log(`    id=${row.event.id}  kind=${row.kind}  created=${row.event.created || '-'}`);
    console.log(`    dry-run: ${dry.action}${dry.reason ? ` (${dry.reason})` : ''}`);
    if (overlapWith.length) {
      console.log(`    overlaps DB:`);
      overlapWith.forEach((line) => console.log(`      - ${line}`));
    }
    console.log('');
  }

  console.log('── Dry-run reason tally ──');
  console.log(reasonTally);

  const watch = await studioSettings.getWatchChannel();
  const now = Date.now();
  const exp = watch.expiration ? new Date(watch.expiration).getTime() : 0;
  console.log('\n── Watch channel ──');
  console.log(`  present:    ${!!watch.channelId}`);
  console.log(`  expires in: ${exp ? `${Math.round((exp - now) / 36e5)} hours` : 'n/a'}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('Gap audit failed:', err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
