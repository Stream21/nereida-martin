#!/usr/bin/env node
/**
 * Audit Google Calendar events for overlaps and likely duplicates.
 * Uses the same time parsing rules as calendarSync.js.
 *
 * Usage:
 *   npm run calendar:audit
 *   npm run calendar:audit -- --from=2026-01-01 --to=2026-12-31
 *   npm run calendar:audit -- --from=2026-07-01 --limit=20
 */

require('dotenv').config();

const googleCalendar = require('../services/googleCalendar');
const { parseEventTimes } = require('../services/calendarSync');
const { normalizeImportedEventTimes } = require('../utils/importedEventTimes');
const { isGhostBlockEvent } = require('../utils/ghostCalendarEvent');

function parseArgs(argv) {
  const options = { from: '2026-01-01', to: '2026-12-31', limit: 15 };

  for (const arg of argv) {
    if (arg.startsWith('--from=')) options.from = arg.split('=')[1];
    else if (arg.startsWith('--to=')) options.to = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.split('=')[1]);
  }

  return options;
}

function formatRange(start, end) {
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Atlantic/Canary',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return `${fmt.format(start)} → ${fmt.format(end)}`;
}

function overlaps(a, b) {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function fingerprint(event) {
  return [
    (event.summary || '(sin título)').trim().toLowerCase(),
    event.startTime.toISOString(),
    event.endTime.toISOString(),
  ].join('|');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const timeMin = new Date(`${options.from}T00:00:00`).toISOString();
  const timeMax = new Date(`${options.to}T23:59:59`).toISOString();

  console.log('\n=== Calendar overlap audit ===\n');
  console.log(`Calendar ID: ${googleCalendar.getCalendarId()}`);
  console.log(`Range: ${options.from} → ${options.to}\n`);

  const { events } = await googleCalendar.listEvents({ timeMin, timeMax, showDeleted: false });

  const importable = [];
  const skipped = { recurring: 0, missing_times: 0, cancelled: 0, ghost_block: 0, other: 0 };
  const allDayByDate = new Map();

  for (const event of events) {
    if (event.status === 'cancelled') {
      skipped.cancelled++;
      continue;
    }

    if (isGhostBlockEvent(event)) {
      skipped.ghost_block++;
      continue;
    }

    const parsed = parseEventTimes(event);
    if (parsed.skip) {
      skipped[parsed.reason] = (skipped[parsed.reason] || 0) + 1;
      continue;
    }

    const normalized = normalizeImportedEventTimes(parsed.startTime, parsed.endTime);
    const row = {
      id: event.id,
      summary: event.summary || '(sin título)',
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      googleEndTime: parsed.endTime,
      allDay: parsed.allDay,
      htmlLink: event.htmlLink || null,
    };

    importable.push(row);

    if (parsed.allDay) {
      const day = event.start.date;
      if (!allDayByDate.has(day)) allDayByDate.set(day, []);
      allDayByDate.get(day).push(row);
    }
  }

  console.log('Summary');
  console.log(`  Raw events from Google: ${events.length}`);
  console.log(`  Importable (after parse): ${importable.length}`);
  console.log(`  Skipped cancelled:      ${skipped.cancelled}`);
  console.log(`  Skipped ghost [Bloqueo]: ${skipped.ghost_block || 0}`);
  console.log(`  Skipped recurring:      ${skipped.recurring || 0}`);
  console.log(`  Skipped missing times:  ${skipped.missing_times || 0}`);
  console.log(`  All-day importable:     ${importable.filter((e) => e.allDay).length}`);

  const exactDuplicates = new Map();
  for (const row of importable) {
    const key = fingerprint(row);
    if (!exactDuplicates.has(key)) exactDuplicates.set(key, []);
    exactDuplicates.get(key).push(row);
  }

  const duplicateGroups = [...exactDuplicates.values()].filter((g) => g.length > 1);
  console.log(`  Exact duplicate groups: ${duplicateGroups.length}`);

  const overlapPairs = [];
  const sorted = [...importable].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].startTime >= sorted[i].endTime) break;
      if (overlaps(sorted[i], sorted[j])) {
        overlapPairs.push([sorted[i], sorted[j]]);
      }
    }
  }

  console.log(`  Overlapping pairs:      ${overlapPairs.length}\n`);

  if (duplicateGroups.length > 0) {
    console.log(`── Exact duplicates (same title + same time) — top ${options.limit} ──\n`);
    duplicateGroups.slice(0, options.limit).forEach((group, idx) => {
      const sample = group[0];
      console.log(`${idx + 1}. "${sample.summary}"`);
      console.log(`   When: ${formatRange(sample.startTime, sample.endTime)}`);
      console.log(`   Count: ${group.length} events`);
      group.forEach((row, i) => {
        console.log(`   [${i + 1}] id=${row.id}`);
        if (row.htmlLink) console.log(`       ${row.htmlLink}`);
      });
      console.log('');
    });
  }

  const multiAllDayDays = [...allDayByDate.entries()].filter(([, rows]) => rows.length > 1);
  if (multiAllDayDays.length > 0) {
    console.log(`── Days with multiple all-day events (all become 10:00-20:00) — top ${options.limit} ──\n`);
    multiAllDayDays.slice(0, options.limit).forEach(([day, rows], idx) => {
      console.log(`${idx + 1}. ${day} — ${rows.length} events`);
      rows.forEach((row) => {
        console.log(`   - "${row.summary}" (id=${row.id})`);
      });
      console.log('');
    });
  }

  if (overlapPairs.length > 0) {
    console.log(`── Overlapping pairs (what breaks no_overlap) — top ${options.limit} ──\n`);
    overlapPairs.slice(0, options.limit).forEach(([a, b], idx) => {
      console.log(`${idx + 1}. Overlap window: ${formatRange(
        new Date(Math.max(a.startTime, b.startTime)),
        new Date(Math.min(a.endTime, b.endTime))
      )}`);
      console.log(`   A: "${a.summary}" → ${formatRange(a.startTime, a.endTime)}`);
      if (a.googleEndTime.getTime() !== a.endTime.getTime()) {
        console.log(`      (Google end: ${formatRange(a.startTime, a.googleEndTime)})`);
      }
      console.log(`      id=${a.id}`);
      if (a.htmlLink) console.log(`      ${a.htmlLink}`);
      console.log(`   B: "${b.summary}" → ${formatRange(b.startTime, b.endTime)}`);
      if (b.googleEndTime.getTime() !== b.endTime.getTime()) {
        console.log(`      (Google end: ${formatRange(b.startTime, b.googleEndTime)})`);
      }
      console.log(`      id=${b.id}`);
      if (b.htmlLink) console.log(`      ${b.htmlLink}`);
      console.log('');
    });
  }

  if (
    duplicateGroups.length === 0 &&
    multiAllDayDays.length === 0 &&
    overlapPairs.length === 0
  ) {
    console.log('No overlaps or duplicates found with current parsing rules.');
  } else {
    console.log('How to search in Google Calendar:');
    console.log('  1. Open the htmlLink above, or search the exact title in quotes.');
    console.log('  2. For all-day clashes, open that date and look for 2+ full-day events.');
    console.log('  3. For duplicates, same title at the same hour on the same day.\n');
  }
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
