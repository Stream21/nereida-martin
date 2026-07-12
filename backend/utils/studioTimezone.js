const TIMEZONE = process.env.STUDIO_TIMEZONE || 'Atlantic/Canary';

function studioLocalToDate(dateStr, hour, minute = 0) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const utcNoon = Date.UTC(y, mo - 1, d, 12, 0, 0);
  const utcDate = new Date(utcNoon);
  const tzStr = utcDate.toLocaleString('en-US', { timeZone: TIMEZONE });
  const utcStr = utcDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();

  const localMs = Date.UTC(y, mo - 1, d, hour, minute, 0);
  return new Date(localMs - offsetMs);
}

function formatStudioDateTime(date, options = {}) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    ...options,
  }).format(date);
}

function formatStudioTime(date) {
  return formatStudioDateTime(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatStudioDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getStudioDayOfWeek(dateStr) {
  const noon = studioLocalToDate(dateStr, 12, 0);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
  }).format(noon);

  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

function todayStudioDateStr() {
  return formatStudioDate(new Date());
}

function addDaysToDateStr(dateStr, days) {
  const base = studioLocalToDate(dateStr, 12, 0);
  base.setUTCDate(base.getUTCDate() + days);
  return formatStudioDate(base);
}

module.exports = {
  TIMEZONE,
  studioLocalToDate,
  formatStudioDateTime,
  formatStudioTime,
  formatStudioDate,
  getStudioDayOfWeek,
  todayStudioDateStr,
  addDaysToDateStr,
};
