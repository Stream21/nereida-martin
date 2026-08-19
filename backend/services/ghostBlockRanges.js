const googleCalendar = require('./googleCalendar');
const { parseEventTimes } = require('./calendarSync');
const { isGhostBlockEvent } = require('../utils/ghostCalendarEvent');
const { isWebBookingEvent } = require('../utils/webCalendarEvent');
const { normalizeImportedEventTimes } = require('../utils/importedEventTimes');
const { getAllDayBlockRange } = require('../utils/studioHours');
const { addDaysToDateStr, formatStudioDate } = require('../utils/studioTimezone');

const BUSY_CACHE_TTL_MS = 45_000;
const busyCache = [];
const busyInflight = new Map();

function pruneBusyCache(now = Date.now()) {
  for (let i = busyCache.length - 1; i >= 0; i -= 1) {
    if (now - busyCache[i].at > BUSY_CACHE_TTL_MS) busyCache.splice(i, 1);
  }
}

function rangesFromCache(fromMs, toMs) {
  pruneBusyCache();
  for (const entry of busyCache) {
    if (entry.fromMs <= fromMs && entry.toMs >= toMs) {
      return entry.ranges.filter((r) => r.start < toMs && r.end > fromMs);
    }
  }
  return null;
}

async function loadBusyFromGoogle(timeMin, timeMax) {
  try {
    return await googleCalendar.getFreeBusyRange({ timeMin, timeMax });
  } catch (err) {
    console.warn('FreeBusy failed, falling back to listEvents:', err.message);
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
}

async function fetchBusyRanges(timeMin, timeMax) {
  const fromMs = new Date(timeMin).getTime();
  const toMs = new Date(timeMax).getTime();
  const cached = rangesFromCache(fromMs, toMs);
  if (cached) return cached;

  const key = `${fromMs}:${toMs}`;
  if (busyInflight.has(key)) return busyInflight.get(key);

  const pending = loadBusyFromGoogle(timeMin, timeMax)
    .then((ranges) => {
      busyCache.push({ fromMs, toMs, ranges, at: Date.now() });
      if (busyCache.length > 24) busyCache.shift();
      return ranges;
    })
    .finally(() => {
      busyInflight.delete(key);
    });

  busyInflight.set(key, pending);
  return pending;
}

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
  return fetchBusyRanges(timeMin, timeMax);
}

async function getGhostBlockRangesInRange(timeMin, timeMax) {
  return fetchBusyRanges(timeMin, timeMax);
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
