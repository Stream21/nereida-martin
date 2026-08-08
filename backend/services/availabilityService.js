const { query } = require('../db/pool');
const {
  getGhostBlockRangesForDate,
  getGhostBlockRangesInRange,
} = require('./ghostBlockRanges');
const {
  SLOT_MINUTES,
  blockDurationMinutes,
  hasOverlapWithRanges,
  isOnGrid,
} = require('../utils/slotGrid');
const {
  isWeekendDay,
  getWorkWindowsForDate,
  getWindowBounds,
  slotFitsInWorkWindows,
} = require('../utils/studioHours');
const {
  studioLocalToDate,
  formatStudioTime,
  todayStudioDateStr,
  addDaysToDateStr,
} = require('../utils/studioTimezone');
const studioSettings = require('./studioSettings');

const MAX_NEXT_SLOT_DAYS = 90;

async function getBookedRangesForDate(dateStr, excludeBookingId = null) {
  const windows = getWorkWindowsForDate(dateStr);
  if (windows.length === 0) return [];

  const first = getWindowBounds(dateStr, windows[0]);
  const last = getWindowBounds(dateStr, windows[windows.length - 1]);

  const params = [first.start.toISOString(), last.end.toISOString()];
  let sql = `SELECT start_time, end_time FROM bookings
     WHERE status IN ('confirmed', 'pending_review')
       AND start_time < $2
       AND end_time > $1`;

  if (excludeBookingId) {
    sql += ' AND id != $3';
    params.push(excludeBookingId);
  }

  const result = await query(sql, params);

  return result.rows.map((row) => ({
    start: new Date(row.start_time).getTime(),
    end: new Date(row.end_time).getTime(),
  }));
}

async function getBusyRangesForDate(dateStr, excludeBookingId = null) {
  let ghostRanges = [];
  try {
    ghostRanges = await getGhostBlockRangesForDate(dateStr);
  } catch (err) {
    console.warn(`Ghost blocks skipped for ${dateStr}:`, err.message);
  }

  const bookedRanges = await getBookedRangesForDate(dateStr, excludeBookingId);
  return [...bookedRanges, ...ghostRanges];
}

// Client-facing start times: consecutive appointments packed by treatment
// duration (10:00, 10:45, 11:30... for 45 min). The internal 15-min grid is
// only used to re-anchor after a conflict, so clients never see raw grid slots.
function getSlotsForDate(dateStr, blockDurationMinutes, busyRanges, now = Date.now()) {
  if (isWeekendDay(dateStr)) return [];

  const windows = getWorkWindowsForDate(dateStr);
  const blockMs = blockDurationMinutes * 60000;
  const slots = [];

  for (const window of windows) {
    const { start, end } = getWindowBounds(dateStr, window);
    let cursor = start.getTime();

    while (cursor + blockMs <= end.getTime()) {
      const slotEnd = cursor + blockMs;
      const isPast = cursor <= now;
      const hasConflict = hasOverlapWithRanges(
        new Date(cursor),
        new Date(slotEnd),
        busyRanges
      );

      if (!isPast && !hasConflict) {
        slots.push({
          time: formatStudioTime(new Date(cursor)),
          available: true,
        });
        cursor = slotEnd;
      } else {
        cursor += SLOT_MINUTES * 60000;
      }
    }
  }

  return slots;
}

async function getAvailabilityForDate(dateStr, treatmentId) {
  const treatmentResult = await query(
    'SELECT duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
    [treatmentId]
  );

  if (treatmentResult.rows.length === 0) {
    return { error: 'not_found' };
  }

  const treatment = treatmentResult.rows[0];
  const blockMinutes = blockDurationMinutes(
    treatment.duration_max || treatment.duration_min
  );

  const bookingStartDate = await studioSettings.getBookingStartDate();
  if (dateStr < bookingStartDate || isWeekendDay(dateStr)) {
    return {
      slots: [],
      date: dateStr,
      treatmentId,
      bookingStartDate,
      slotMinutes: SLOT_MINUTES,
      blockMinutes,
    };
  }

  const busyRanges = await getBusyRangesForDate(dateStr);
  const slots = getSlotsForDate(dateStr, blockMinutes, busyRanges);

  return {
    slots,
    date: dateStr,
    treatmentId,
    bookingStartDate,
    slotMinutes: SLOT_MINUTES,
    blockMinutes,
  };
}

async function hasSlotAvailable(dateStr, timeStr, blockMinutes, excludeBookingId = null) {
  if (isWeekendDay(dateStr)) return false;

  const [hour, minute] = timeStr.split(':').map(Number);
  const start = studioLocalToDate(dateStr, hour, minute);
  const end = new Date(start.getTime() + blockMinutes * 60000);

  if (!isOnGrid(start)) return false;
  if (!slotFitsInWorkWindows(dateStr, start.getTime(), end.getTime())) return false;

  const bookingStartDate = await studioSettings.getBookingStartDate();
  if (dateStr < bookingStartDate) return false;
  if (start.getTime() <= Date.now()) return false;

  const busyRanges = await getBusyRangesForDate(dateStr, excludeBookingId);
  return !hasOverlapWithRanges(start, end, busyRanges);
}

async function findNextAvailableSlot(treatmentId, fromDateStr = null) {
  const treatmentResult = await query(
    'SELECT duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
    [treatmentId]
  );

  if (treatmentResult.rows.length === 0) {
    return { error: 'not_found' };
  }

  const treatment = treatmentResult.rows[0];
  const blockMinutes = blockDurationMinutes(
    treatment.duration_max || treatment.duration_min
  );

  const bookingStartDate = await studioSettings.getBookingStartDate();
  let cursorDate =
    fromDateStr || todayStudioDateStr();

  if (cursorDate < bookingStartDate) {
    cursorDate = bookingStartDate;
  }

  for (let i = 0; i < MAX_NEXT_SLOT_DAYS; i++) {
    const dateStr = addDaysToDateStr(cursorDate, i);
    if (dateStr < bookingStartDate) continue;

    const busyRanges = await getBusyRangesForDate(dateStr);
    const slots = getSlotsForDate(dateStr, blockMinutes, busyRanges);
    const first = slots.find((s) => s.available);

    if (first) {
      return {
        date: dateStr,
        time: first.time,
        blockMinutes,
        treatmentId,
      };
    }
  }

  return { date: null, time: null, blockMinutes, treatmentId };
}

function monthDateBounds(year, month) {
  const mm = String(month).padStart(2, '0');
  const firstDate = `${year}-${mm}-01`;
  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDate = `${year}-${mm}-${String(lastDayNum).padStart(2, '0')}`;
  const windowsFirst = getWorkWindowsForDate(firstDate);
  const windowsLast = getWorkWindowsForDate(lastDate);

  // Use noon bounds if weekend (no windows); still cover full calendar days for busy queries
  const rangeStart = windowsFirst.length
    ? getWindowBounds(firstDate, windowsFirst[0]).start
    : studioLocalToDate(firstDate, 0, 0);
  const rangeEnd = windowsLast.length
    ? getWindowBounds(lastDate, windowsLast[windowsLast.length - 1]).end
    : studioLocalToDate(lastDate, 23, 59);

  return { firstDate, lastDate, lastDayNum, rangeStart, rangeEnd };
}

function rangesOverlappingDay(allRanges, dateStr) {
  const windows = getWorkWindowsForDate(dateStr);
  if (windows.length === 0) return [];

  const dayStart = getWindowBounds(dateStr, windows[0]).start.getTime();
  const dayEnd = getWindowBounds(dateStr, windows[windows.length - 1]).end.getTime();

  return allRanges.filter((r) => r.start < dayEnd && r.end > dayStart);
}

async function getAvailableDatesForMonth(year, month, treatmentId) {
  const treatmentResult = await query(
    'SELECT duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
    [treatmentId]
  );

  if (treatmentResult.rows.length === 0) {
    return { error: 'not_found' };
  }

  const treatment = treatmentResult.rows[0];
  const blockMinutes = blockDurationMinutes(
    treatment.duration_max || treatment.duration_min
  );
  const bookingStartDate = await studioSettings.getBookingStartDate();
  const { firstDate, lastDate, lastDayNum, rangeStart, rangeEnd } = monthDateBounds(
    year,
    month
  );

  const bookedResult = await query(
    `SELECT start_time, end_time FROM bookings
     WHERE status IN ('confirmed', 'pending_review')
       AND start_time < $2
       AND end_time > $1`,
    [rangeStart.toISOString(), rangeEnd.toISOString()]
  );

  const bookedRanges = bookedResult.rows.map((row) => ({
    start: new Date(row.start_time).getTime(),
    end: new Date(row.end_time).getTime(),
  }));

  let ghostRanges = [];
  try {
    ghostRanges = await getGhostBlockRangesInRange(
      rangeStart.toISOString(),
      rangeEnd.toISOString()
    );
  } catch (err) {
    console.warn(`Ghost blocks skipped for ${year}-${month}:`, err.message);
  }

  const allBusy = [...bookedRanges, ...ghostRanges];
  const dates = [];

  for (let day = 1; day <= lastDayNum; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr < bookingStartDate || isWeekendDay(dateStr)) continue;
    if (dateStr < firstDate || dateStr > lastDate) continue;

    const busyRanges = rangesOverlappingDay(allBusy, dateStr);
    const slots = getSlotsForDate(dateStr, blockMinutes, busyRanges);
    if (slots.some((s) => s.available)) {
      dates.push(dateStr);
    }
  }

  return {
    year,
    month,
    treatmentId,
    bookingStartDate,
    dates,
    blockMinutes,
  };
}

module.exports = {
  getBookedRangesForDate,
  getBusyRangesForDate,
  getSlotsForDate,
  getAvailabilityForDate,
  getAvailableDatesForMonth,
  hasSlotAvailable,
  findNextAvailableSlot,
};
