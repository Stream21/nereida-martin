const googleCalendar = require('./googleCalendar');
const { parseEventTimes } = require('./calendarSync');
const { isGhostBlockEvent } = require('../utils/ghostCalendarEvent');
const { normalizeImportedEventTimes } = require('../utils/importedEventTimes');
const { getAllDayBlockRange } = require('../utils/studioHours');
const { addDaysToDateStr } = require('../utils/studioTimezone');

/**
 * [Bloqueo] events from Google Calendar → busy ranges for web availability.
 * Not stored in bookings (Nereida's manual day-off / closure blocks).
 */
function appendGhostEventRanges(event, ranges, { onlyDateStr = null } = {}) {
  if (!isGhostBlockEvent(event) || event.status === 'cancelled') return;

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
    appendGhostEventRanges(event, ranges, { onlyDateStr: dateStr });
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
    appendGhostEventRanges(event, ranges);
  }
  return ranges;
}

module.exports = {
  getGhostBlockRangesForDate,
  getGhostBlockRangesInRange,
};
