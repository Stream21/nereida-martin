const { TIMEZONE, studioLocalToDate } = require('./studioTimezone');

function getCancellationDeadline(startTime) {
  const start = new Date(startTime);
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(start);

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(start);

  const [hour, minute] = timeStr.split(':').map(Number);
  const prevDay = new Date(studioLocalToDate(dateStr, 12, 0));
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);

  const prevDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(prevDay);

  return studioLocalToDate(prevDateStr, hour, minute);
}

function canCancel(startTime, now = new Date()) {
  return now < getCancellationDeadline(new Date(startTime));
}

function formatDeadlineSpanish(startTime) {
  const deadline = getCancellationDeadline(new Date(startTime));
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(deadline);
}

const POLICY_TEXT =
  'Puedes cancelar hasta el día anterior a tu cita, a la misma hora. Ejemplo: cita el miércoles a las 10:00 → cancelación hasta el martes a las 10:00.';

module.exports = {
  TIMEZONE,
  getCancellationDeadline,
  canCancel,
  formatDeadlineSpanish,
  POLICY_TEXT,
};
