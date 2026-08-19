const googleCalendar = require('./googleCalendar');
const { parseEventTimes } = require('./calendarSync');
const { isGhostBlockEvent } = require('../utils/ghostCalendarEvent');
const { isWebBookingEvent } = require('../utils/webCalendarEvent');
const { normalizeImportedEventTimes } = require('../utils/importedEventTimes');
const { getAllDayBlockRange } = require('../utils/studioHours');
const { addDaysToDateStr, formatStudioDate } = require('../utils/studioTimezone');

/**
 * Google Calendar → busy ranges for web availability.
 *
 * Includes timed/all-day events even if they were not imported into bookings
 * (sync delay, overlap/fantasma skip, trips, iOS-created events).
 * [Bloqueo] stays out of the DB but still closes the web here.
 */
function isBusyGoogleEvent(event) {
  if (!event || event.status === 'cancelled') return false;
  if (event.transparency === 'transparent') return false;
  return true;
}

function appendGoogleBusyEventRanges(event, ranges, { onlyDateStr = null } = {}) {
  if (!isBusyGoogleEvent(event)) return;

  if (event.start?.date && !event.start?.dateTime) {
    const startDate = event.start.date;
    // Google all-day end.date is exclusive
    const endExclusive = event.end?.date || addDaysToDateStr(startDate, 1);
    let cursor = startDate;
    while (cursor < endExclusive) {
      if (!onlyDateStr || cursor === onlyDateStr) {
        const block = getAllDayBlockRange(cursor);
        if (block) ranges.push(block);
      }
      cursor = addDaysToDateStr(cursor, 1);
    }
    return;
  }

  const parsed = parseEventTimes(event);
  if (parsed.skip) return;

  const { startTime, endTime } = normalizeImportedEventTimes(
    parsed.startTime,
    parsed.endTime
  );

  ranges.push({
    start: startTime.getTime(),
    end: endTime.getTime(),
  });
}

async function getGhostBlockRangesForDate(dateStr) {
  const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
  const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();

  const { events } = await googleCalendar.listEvents({
    timeMin,
    timeMax,
    showDeleted: false,
  });

  const ranges = [];
  for (const event of events) {
    appendGoogleBusyEventRanges(event, ranges, { onlyDateStr: dateStr });
  }
  return ranges;
}

async function getGhostBlockRangesInRange(timeMin, timeMax) {
  const { events } = await googleCalendar.listEvents({
    timeMin,
    timeMax,
    showDeleted: false,
  });

  const ranges = [];
  for (const event of events) {
    appendGoogleBusyEventRanges(event, ranges);
  }
  return ranges;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function expandItemAcrossDays(startTime, endTime, { from, to }) {
  if (endTime.getTime() - startTime.getTime() <= DAY_MS) {
    return [{ startTime, endTime }];
  }

  const windowStart = new Date(from);
  const windowEnd = new Date(to);
  let cursor = formatStudioDate(startTime < windowStart ? windowStart : startTime);
  const last = formatStudioDate(new Date(Math.min(endTime.getTime(), windowEnd.getTime()) - 1));
  const slices = [];

  while (cursor <= last) {
    const block = getAllDayBlockRange(cursor);
    if (block) {
      slices.push({
        startTime: new Date(block.start),
        endTime: new Date(block.end),
        dateKey: cursor,
      });
    }
    cursor = addDaysToDateStr(cursor, 1);
  }

  return slices.length > 0 ? slices : [{ startTime, endTime }];
}

async function listGoogleCalendarItemsInRange(from, to) {
  const { events } = await googleCalendar.listEvents({
    timeMin: from,
    timeMax: to,
    showDeleted: false,
  });

  const items = [];

  for (const event of events) {
    if (!isBusyGoogleEvent(event)) continue;

    let startTime;
    let endTime;
    if (event.start?.date && !event.start?.dateTime) {
      const startDate = event.start.date;
      const endExclusive = event.end?.date || addDaysToDateStr(startDate, 1);
      let cursor = startDate;
      while (cursor < endExclusive) {
        const block = getAllDayBlockRange(cursor);
        if (block) {
          items.push({
            googleEventId: event.id,
            summary: (event.summary || 'Google Calendar').trim(),
            startTime: new Date(block.start),
            endTime: new Date(block.end),
            htmlLink: event.htmlLink || null,
            isGhost: isGhostBlockEvent(event),
            webBookingId: event.extendedProperties?.private?.bookingId || null,
            isWeb: isWebBookingEvent(event),
            dateKey: cursor,
          });
        }
        cursor = addDaysToDateStr(cursor, 1);
      }
      continue;
    }

    const parsed = parseEventTimes(event);
    if (parsed.skip) continue;
    ({ startTime, endTime } = normalizeImportedEventTimes(parsed.startTime, parsed.endTime));

    const slices = expandItemAcrossDays(startTime, endTime, { from, to });
    for (const slice of slices) {
      items.push({
        googleEventId: event.id,
        summary: (event.summary || 'Google Calendar').trim(),
        startTime: slice.startTime,
        endTime: slice.endTime,
        htmlLink: event.htmlLink || null,
        isGhost: isGhostBlockEvent(event),
        webBookingId: event.extendedProperties?.private?.bookingId || null,
        isWeb: isWebBookingEvent(event),
        dateKey: slice.dateKey || null,
      });
    }
  }

  return items;
}

module.exports = {
  getGhostBlockRangesForDate,
  getGhostBlockRangesInRange,
  listGoogleCalendarItemsInRange,
};
