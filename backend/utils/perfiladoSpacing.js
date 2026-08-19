const { formatStudioDate, getStudioDayOfWeek, addDaysToDateStr } = require('./studioTimezone');

const PERFILADO_TREATMENT_IDS = ['brow-design-primera', 'brow-design-seguimiento'];

function isPerfiladoTreatment(treatmentId) {
  return PERFILADO_TREATMENT_IDS.includes(treatmentId);
}

function mondayOfStudioDate(dateOrStr) {
  const dateStr =
    typeof dateOrStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrStr)
      ? dateOrStr
      : formatStudioDate(dateOrStr);
  const dow = getStudioDayOfWeek(dateStr);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDaysToDateStr(dateStr, offset);
}

function blockedWeeksFromBookings(bookings) {
  const weeks = new Set();
  for (const booking of bookings || []) {
    if (!isPerfiladoTreatment(booking.treatment_id || booking.treatmentId)) continue;
    const status = booking.status;
    if (status && !['confirmed', 'pending_review', 'pending_companion'].includes(status)) continue;
    const start = booking.start_time || booking.startTime;
    if (!start) continue;
    weeks.add(mondayOfStudioDate(new Date(start)));
  }
  return [...weeks];
}

async function loadPerfiladoBlockedWeekSet(clientId, excludeBookingId) {
  if (!clientId) return new Set();
  const { query } = require('../db/pool');
  const params = [clientId, PERFILADO_TREATMENT_IDS];
  let sql = `SELECT treatment_id, status, start_time
     FROM bookings
     WHERE client_id = $1
       AND treatment_id = ANY($2::text[])
       AND status IN ('confirmed', 'pending_review', 'pending_companion')`;
  if (excludeBookingId) {
    sql += ' AND id <> $3';
    params.push(excludeBookingId);
  }
  const result = await query(sql, params);
  return new Set(blockedWeeksFromBookings(result.rows));
}

async function findPerfiladoWeekConflict({ clientId, treatmentId, startTime, excludeBookingId }) {
  if (!isPerfiladoTreatment(treatmentId) || !clientId || !startTime) return null;

  const weeks = await loadPerfiladoBlockedWeekSet(clientId, excludeBookingId);
  const targetWeek = mondayOfStudioDate(startTime);
  if (!weeks.has(targetWeek)) return null;

  return {
    code: 'PERFILADO_WEEKLY_LIMIT',
    error: 'Ya tienes un perfilado esta semana',
    message:
      'Solo puedes reservar un perfilado por semana. Elige una fecha de la semana siguiente.',
    blockedWeekMonday: targetWeek,
  };
}

module.exports = {
  PERFILADO_TREATMENT_IDS,
  isPerfiladoTreatment,
  mondayOfStudioDate,
  blockedWeeksFromBookings,
  loadPerfiladoBlockedWeekSet,
  findPerfiladoWeekConflict,
};
