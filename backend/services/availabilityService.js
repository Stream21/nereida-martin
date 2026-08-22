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
const { isBeforeMinLead } = require('../utils/bookingLeadTime');

const MAX_NEXT_SLOT_DAYS = 90;

async function getBookedRangesForDate(dateStr, excludeBookingId = null) {
  const windows = getWorkWindowsForDate(dateStr);
  if (windows.length === 0) return [];

  const first = getWindowBounds(dateStr, windows[0]);
  const last = getWindowBounds(dateStr, windows[windows.length - 1]);

  const params = [first.start.toISOString(), last.end.toISOString()];
  let sql = `SELECT start_time, end_time FROM bookings
     WHERE status IN ('confirmed', 'pending_review', 'pending_companion', 'google_overlap')
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
  const [bookedRanges, ghostRanges] = await Promise.all([
    getBookedRangesForDate(dateStr, excludeBookingId),
    getGhostBlockRangesForDate(dateStr).catch((err) => {
      console.warn(`Ghost blocks skipped for ${dateStr}:`, err.message);
      return [];
    }),
  ]);
  return [...bookedRanges, ...ghostRanges];
}

// Client-facing start times: consecutive appointments packed by treatment
// duration (10:00, 10:45, 11:30... for 45 min). The internal 15-min grid is
// only used to re-anchor after a conflict, so clients never see raw grid slots.
function getSlotsForDate(
  dateStr,
  blockDurationMinutes,
  busyRanges,
  now = Date.now(),
  { skipLeadTime = false } = {}
) {
  if (isWeekendDay(dateStr)) return [];

  const windows = getWorkWindowsForDate(dateStr);
  const blockMs = blockDurationMinutes * 60000;
  const slots = [];

  for (const window of windows) {
    const { start, end } = getWindowBounds(dateStr, window);
    let cursor = start.getTime();

    while (cursor + blockMs <= end.getTime()) {
      const slotEnd = cursor + blockMs;
      const tooSoon = !skipLeadTime && isBeforeMinLead(cursor, now);
      const hasConflict = hasOverlapWithRanges(
        new Date(cursor),
        new Date(slotEnd),
        busyRanges
      );

      if (!tooSoon && !hasConflict) {
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

function snapDurationToGrid(minutes, fallbackMinutes) {
  const { SLOT_MINUTES: step } = require('../utils/slotGrid');
  const raw = Number(minutes);
  const base = Number.isFinite(raw) && raw > 0 ? raw : fallbackMinutes;
  return Math.max(step, Math.ceil(base / step) * step);
}

async function getAvailabilityForDate(
  dateStr,
  treatmentId,
  { allowInactiveIds = [], durationMinutes = null, skipLeadTime = false } = {}
) {
  const allowInactive = allowInactiveIds.includes(treatmentId);
  const treatmentResult = await query(
    allowInactive
      ? 'SELECT duration_min, duration_max FROM treatments WHERE id = $1'
      : 'SELECT duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
    [treatmentId]
  );

  if (treatmentResult.rows.length === 0) {
    return { error: 'not_found' };
  }

  const treatment = treatmentResult.rows[0];
  const defaultBlock = blockDurationMinutes(
    treatment.duration_max || treatment.duration_min
  );
  const blockMinutes =
    durationMinutes != null ? snapDurationToGrid(durationMinutes, defaultBlock) : defaultBlock;

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
  const slots = getSlotsForDate(dateStr, blockMinutes, busyRanges, Date.now(), {
    skipLeadTime,
  });

  return {
    slots,
    date: dateStr,
    treatmentId,
    bookingStartDate,
    slotMinutes: SLOT_MINUTES,
    blockMinutes,
  };
}

async function hasSlotAvailable(
  dateStr,
  timeStr,
  blockMinutes,
  excludeBookingId = null,
  { skipLeadTime = false } = {}
) {
  if (isWeekendDay(dateStr)) return false;

  const [hour, minute] = timeStr.split(':').map(Number);
  const start = studioLocalToDate(dateStr, hour, minute);
  const end = new Date(start.getTime() + blockMinutes * 60000);

  if (!isOnGrid(start)) return false;
  if (!slotFitsInWorkWindows(dateStr, start.getTime(), end.getTime())) return false;

  const bookingStartDate = await studioSettings.getBookingStartDate();
  if (dateStr < bookingStartDate) return false;
  if (!skipLeadTime && isBeforeMinLead(start.getTime())) return false;

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
  let cursorDate = fromDateStr || todayStudioDateStr();

  if (cursorDate < bookingStartDate) {
    cursorDate = bookingStartDate;
  }

  const lastDate = addDaysToDateStr(cursorDate, MAX_NEXT_SLOT_DAYS - 1);
  const rangeStart = studioLocalToDate(cursorDate, 0, 0);
  const rangeEnd = studioLocalToDate(lastDate, 23, 59);

  const [bookedResult, ghostRanges] = await Promise.all([
    query(
      `SELECT start_time, end_time FROM bookings
       WHERE status IN ('confirmed', 'pending_review', 'pending_companion', 'google_overlap')
         AND start_time < $2
         AND end_time > $1`,
      [rangeStart.toISOString(), rangeEnd.toISOString()]
    ),
    getGhostBlockRangesInRange(rangeStart.toISOString(), rangeEnd.toISOString()).catch((err) => {
      console.warn('Ghost blocks skipped for next slot:', err.message);
      return [];
    }),
  ]);

  const allBusy = [
    ...bookedResult.rows.map((row) => ({
      start: new Date(row.start_time).getTime(),
      end: new Date(row.end_time).getTime(),
    })),
    ...ghostRanges,
  ];

  for (let i = 0; i < MAX_NEXT_SLOT_DAYS; i++) {
    const dateStr = addDaysToDateStr(cursorDate, i);
    if (dateStr < bookingStartDate) continue;

    const busyRanges = rangesOverlappingDay(allBusy, dateStr);
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
  const { firstDate, lastDate, lastDayNum, rangeStart, rangeEnd } = monthDateBounds(
    year,
    month
  );

  const [bookingStartDate, bookedResult, ghostRanges] = await Promise.all([
    studioSettings.getBookingStartDate(),
    query(
      `SELECT start_time, end_time FROM bookings
       WHERE status IN ('confirmed', 'pending_review', 'pending_companion', 'google_overlap')
         AND start_time < $2
         AND end_time > $1`,
      [rangeStart.toISOString(), rangeEnd.toISOString()]
    ),
    getGhostBlockRangesInRange(rangeStart.toISOString(), rangeEnd.toISOString()).catch((err) => {
      console.warn(`Ghost blocks skipped for ${year}-${month}:`, err.message);
      return [];
    }),
  ]);

  const bookedRanges = bookedResult.rows.map((row) => ({
    start: new Date(row.start_time).getTime(),
    end: new Date(row.end_time).getTime(),
  }));

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

async function loadJointTreatmentBlocks(primaryTreatmentId, companionClientId, primaryClientId) {
  const { resolveCompanionTreatment, resolvePrimaryTreatment, isJointTreatment, getJointPersonBlockMinutes } = require('./jointBookingService');

  let primaryBlock;
  let realPrimaryTreatmentId = primaryTreatmentId;

  if (isJointTreatment(primaryTreatmentId) && primaryClientId) {
    const primaryInfo = await resolvePrimaryTreatment(primaryClientId);
    if (primaryInfo.error) return primaryInfo;
    primaryBlock = primaryInfo.blockMinutes;
    realPrimaryTreatmentId = primaryInfo.companionTreatmentId;
  } else {
    const primaryRes = await query(
      'SELECT duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
      [primaryTreatmentId]
    );
    if (primaryRes.rows.length === 0) return { error: 'not_found' };
    primaryBlock = blockDurationMinutes(
      primaryRes.rows[0].duration_max || primaryRes.rows[0].duration_min
    );
  }

  const companionInfo = await resolveCompanionTreatment(companionClientId);
  if (companionInfo.error) return companionInfo;

  if (isJointTreatment(primaryTreatmentId)) {
    const personBlock = await getJointPersonBlockMinutes();
    primaryBlock = personBlock;
    companionInfo.blockMinutes = personBlock;
  }

  return {
    primaryBlock,
    companionBlock: companionInfo.blockMinutes,
    companionTreatmentId: companionInfo.companionTreatmentId,
    companionTreatmentName: companionInfo.companionTreatmentName,
    realPrimaryTreatmentId,
  };
}

function getJointSlotsForDate(
  dateStr,
  primaryBlockMinutes,
  companionBlockMinutes,
  busyRanges,
  now = Date.now()
) {
  if (isWeekendDay(dateStr)) return [];

  const primarySlots = getSlotsForDate(dateStr, primaryBlockMinutes, busyRanges, now);
  const jointSlots = [];

  for (const slot of primarySlots) {
    if (!slot.available) continue;

    const [hour, minute] = slot.time.split(':').map(Number);
    const primaryStart = studioLocalToDate(dateStr, hour, minute);
    const primaryEnd = new Date(primaryStart.getTime() + primaryBlockMinutes * 60000);
    const companionStart = primaryEnd;
    const companionEnd = new Date(companionStart.getTime() + companionBlockMinutes * 60000);

    if (!slotFitsInWorkWindows(dateStr, companionStart.getTime(), companionEnd.getTime())) {
      continue;
    }

    if (
      hasOverlapWithRanges(primaryStart, primaryEnd, busyRanges) ||
      hasOverlapWithRanges(companionStart, companionEnd, busyRanges)
    ) {
      continue;
    }

    jointSlots.push({
      time: slot.time,
      available: true,
      companionTime: formatStudioTime(companionStart),
      companionEndTime: formatStudioTime(companionEnd),
      primaryEndTime: formatStudioTime(primaryEnd),
    });
  }

  return jointSlots;
}

async function hasJointSlotAvailable(
  dateStr,
  timeStr,
  primaryTreatmentId,
  companionClientId,
  primaryClientId,
  { skipPerfiladoLimit = false, skipLeadTime = false } = {}
) {
  const blocks = await loadJointTreatmentBlocks(primaryTreatmentId, companionClientId, primaryClientId);
  if (blocks.error) return false;

  const [hour, minute] = timeStr.split(':').map(Number);
  const primaryStart = studioLocalToDate(dateStr, hour, minute);
  const primaryEnd = new Date(primaryStart.getTime() + blocks.primaryBlock * 60000);
  const companionStart = primaryEnd;
  const companionEnd = new Date(companionStart.getTime() + blocks.companionBlock * 60000);

  if (!isOnGrid(primaryStart)) return false;
  if (!slotFitsInWorkWindows(dateStr, primaryStart.getTime(), primaryEnd.getTime())) return false;
  if (!slotFitsInWorkWindows(dateStr, companionStart.getTime(), companionEnd.getTime())) return false;

  const bookingStartDate = await studioSettings.getBookingStartDate();
  if (dateStr < bookingStartDate) return false;
  if (!skipLeadTime && isBeforeMinLead(primaryStart.getTime())) return false;

  const busyRanges = await getBusyRangesForDate(dateStr);
  if (
    hasOverlapWithRanges(primaryStart, primaryEnd, busyRanges) ||
    hasOverlapWithRanges(companionStart, companionEnd, busyRanges)
  ) {
    return false;
  }

  if (!skipPerfiladoLimit) {
    const { findPerfiladoWeekConflict } = require('../utils/perfiladoSpacing');
    const primaryClash = await findPerfiladoWeekConflict({
      clientId: primaryClientId,
      treatmentId: primaryTreatmentId,
      startTime: primaryStart,
    });
    if (primaryClash) return false;

    const companionClash = await findPerfiladoWeekConflict({
      clientId: companionClientId,
      treatmentId: blocks.companionTreatmentId,
      startTime: companionStart,
    });
    if (companionClash) return false;
  }

  return true;
}

async function getJointAvailabilityForDate(
  dateStr,
  primaryTreatmentId,
  companionClientId,
  primaryClientId,
  { skipPerfiladoLimit = false, skipLeadTime = false } = {}
) {
  const blocks = await loadJointTreatmentBlocks(primaryTreatmentId, companionClientId, primaryClientId);
  if (blocks.error) return blocks;

  const bookingStartDate = await studioSettings.getBookingStartDate();
  if (dateStr < bookingStartDate || isWeekendDay(dateStr)) {
    return {
      slots: [],
      date: dateStr,
      treatmentId: primaryTreatmentId,
      realPrimaryTreatmentId: blocks.realPrimaryTreatmentId,
      companionTreatmentId: blocks.companionTreatmentId,
      companionTreatmentName: blocks.companionTreatmentName,
      bookingStartDate,
      primaryBlockMinutes: blocks.primaryBlock,
      companionBlockMinutes: blocks.companionBlock,
    };
  }

  const busyRanges = await getBusyRangesForDate(dateStr);
  const now = skipLeadTime ? 0 : Date.now();
  let slots = getJointSlotsForDate(
    dateStr,
    blocks.primaryBlock,
    blocks.companionBlock,
    busyRanges,
    now
  );

  if (!skipPerfiladoLimit && primaryClientId) {
    const { loadPerfiladoBlockedWeekSet, mondayOfStudioDate } = require('../utils/perfiladoSpacing');
    const week = mondayOfStudioDate(dateStr);
    const [primaryWeeks, companionWeeks] = await Promise.all([
      loadPerfiladoBlockedWeekSet(primaryClientId),
      loadPerfiladoBlockedWeekSet(companionClientId),
    ]);
    if (primaryWeeks.has(week) || companionWeeks.has(week)) {
      slots = [];
    }
  }

  return {
    slots,
    date: dateStr,
    treatmentId: primaryTreatmentId,
    realPrimaryTreatmentId: blocks.realPrimaryTreatmentId,
    companionTreatmentId: blocks.companionTreatmentId,
    companionTreatmentName: blocks.companionTreatmentName,
    bookingStartDate,
    primaryBlockMinutes: blocks.primaryBlock,
    companionBlockMinutes: blocks.companionBlock,
  };
}

async function getJointAvailableDatesForMonth(
  year,
  month,
  primaryTreatmentId,
  companionClientId,
  primaryClientId,
  { skipPerfiladoLimit = false, skipLeadTime = false } = {}
) {
  const blocks = await loadJointTreatmentBlocks(primaryTreatmentId, companionClientId, primaryClientId);
  if (blocks.error) return blocks;

  const { firstDate, lastDate, lastDayNum, rangeStart, rangeEnd } = monthDateBounds(year, month);
  const { loadPerfiladoBlockedWeekSet, mondayOfStudioDate } = require('../utils/perfiladoSpacing');

  const [bookingStartDate, bookedResult, ghostRanges, primaryWeeks, companionWeeks] = await Promise.all([
    studioSettings.getBookingStartDate(),
    query(
      `SELECT start_time, end_time FROM bookings
       WHERE status IN ('confirmed', 'pending_review', 'pending_companion', 'google_overlap')
         AND start_time < $2 AND end_time > $1`,
      [rangeStart.toISOString(), rangeEnd.toISOString()]
    ),
    getGhostBlockRangesInRange(rangeStart.toISOString(), rangeEnd.toISOString()).catch((err) => {
      console.warn(`Ghost blocks skipped for joint ${year}-${month}:`, err.message);
      return [];
    }),
    skipPerfiladoLimit || !primaryClientId
      ? Promise.resolve(new Set())
      : loadPerfiladoBlockedWeekSet(primaryClientId),
    skipPerfiladoLimit
      ? Promise.resolve(new Set())
      : loadPerfiladoBlockedWeekSet(companionClientId),
  ]);

  const bookedRanges = bookedResult.rows.map((row) => ({
    start: new Date(row.start_time).getTime(),
    end: new Date(row.end_time).getTime(),
  }));

  const allBusy = [...bookedRanges, ...ghostRanges];
  const dates = [];
  const now = skipLeadTime ? 0 : Date.now();

  for (let day = 1; day <= lastDayNum; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr < bookingStartDate || isWeekendDay(dateStr)) continue;

    if (!skipPerfiladoLimit) {
      const week = mondayOfStudioDate(dateStr);
      if (primaryWeeks.has(week) || companionWeeks.has(week)) continue;
    }

    const busyRanges = rangesOverlappingDay(allBusy, dateStr);
    const slots = getJointSlotsForDate(
      dateStr,
      blocks.primaryBlock,
      blocks.companionBlock,
      busyRanges,
      now
    );

    if (slots.some((s) => s.available)) {
      dates.push(dateStr);
    }
  }

  return {
    year,
    month,
    treatmentId: primaryTreatmentId,
    companionTreatmentId: blocks.companionTreatmentId,
    companionTreatmentName: blocks.companionTreatmentName,
    bookingStartDate,
    dates,
    primaryBlockMinutes: blocks.primaryBlock,
    companionBlockMinutes: blocks.companionBlock,
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
  loadJointTreatmentBlocks,
  getJointSlotsForDate,
  hasJointSlotAvailable,
  getJointAvailabilityForDate,
  getJointAvailableDatesForMonth,
};
