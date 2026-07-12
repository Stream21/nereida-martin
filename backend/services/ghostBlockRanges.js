const googleCalendar = require('./googleCalendar');
const { parseEventTimes } = require('./calendarSync');
const { isGhostBlockEvent } = require('../utils/ghostCalendarEvent');
const { normalizeImportedEventTimes } = require('../utils/importedEventTimes');
const { getAllDayBlockRange } = require('../utils/studioHours');

/**
 * [Bloqueo] events from Google Calendar → busy ranges for web availability.
 * Not stored in bookings (Nereida's manual day-off / closure blocks).
 */
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
    if (!isGhostBlockEvent(event) || event.status === 'cancelled') continue;

    if (event.start?.date && !event.start?.dateTime) {
      const block = getAllDayBlockRange(dateStr);
      if (block) ranges.push(block);
      continue;
    }

    const parsed = parseEventTimes(event);
    if (parsed.skip) continue;

    const { startTime, endTime } = normalizeImportedEventTimes(
      parsed.startTime,
      parsed.endTime
    );

    ranges.push({
      start: startTime.getTime(),
      end: endTime.getTime(),
    });
  }

  return ranges;
}

module.exports = {
  getGhostBlockRangesForDate,
};
