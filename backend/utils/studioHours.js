const { studioLocalToDate, getStudioDayOfWeek } = require('./studioTimezone');

const WORK_WINDOWS_WEEKDAY = [
  { startHour: 10, startMin: 0, endHour: 14, endMin: 0 },
  { startHour: 15, startMin: 0, endHour: 18, endMin: 0 },
];

function isWeekendDay(dateStr) {
  const day = getStudioDayOfWeek(dateStr);
  return day === 0 || day === 6;
}

function getWorkWindowsForDate(dateStr) {
  if (isWeekendDay(dateStr)) return [];
  return WORK_WINDOWS_WEEKDAY;
}

function getWindowBounds(dateStr, window) {
  return {
    start: studioLocalToDate(dateStr, window.startHour, window.startMin),
    end: studioLocalToDate(dateStr, window.endHour, window.endMin),
  };
}

function getAllDayBlockRange(dateStr) {
  const windows = getWorkWindowsForDate(dateStr);
  if (windows.length === 0) return null;

  const first = getWindowBounds(dateStr, windows[0]);
  const last = getWindowBounds(dateStr, windows[windows.length - 1]);

  return {
    start: first.start.getTime(),
    end: last.end.getTime(),
  };
}

function isWithinWorkHours(date) {
  const dateStr = date.toISOString().slice(0, 10);
  const windows = getWorkWindowsForDate(dateStr);
  if (windows.length === 0) return false;

  const time = date.getTime();
  return windows.some((window) => {
    const { start, end } = getWindowBounds(dateStr, window);
    return time >= start.getTime() && time < end.getTime();
  });
}

function slotFitsInWorkWindows(dateStr, slotStartMs, slotEndMs) {
  const windows = getWorkWindowsForDate(dateStr);
  if (windows.length === 0) return false;

  return windows.some((window) => {
    const { start, end } = getWindowBounds(dateStr, window);
    return slotStartMs >= start.getTime() && slotEndMs <= end.getTime();
  });
}

const STUDIO_HOURS_LABEL = 'Lun - Vie: 10:00 - 14:00 y 15:00 - 18:00';

module.exports = {
  WORK_WINDOWS_WEEKDAY,
  STUDIO_HOURS_LABEL,
  isWeekendDay,
  getWorkWindowsForDate,
  getWindowBounds,
  getAllDayBlockRange,
  isWithinWorkHours,
  slotFitsInWorkWindows,
};
