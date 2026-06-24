const TIMEZONE = 'Europe/Madrid';

function getCancellationDeadline(startTime) {
  const deadline = new Date(startTime);
  deadline.setDate(deadline.getDate() - 1);
  return deadline;
}

function canCancel(startTime, now = new Date()) {
  return now < getCancellationDeadline(new Date(startTime));
}

function formatDeadlineSpanish(startTime) {
  const deadline = getCancellationDeadline(new Date(startTime));
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const h = String(deadline.getHours()).padStart(2, '0');
  const m = String(deadline.getMinutes()).padStart(2, '0');
  return `${days[deadline.getDay()]}, ${deadline.getDate()} de ${months[deadline.getMonth()]} de ${deadline.getFullYear()} a las ${h}:${m}`;
}

const POLICY_TEXT =
  'Puedes cancelar hasta el día anterior a tu cita, a la misma hora. Ejemplo: cita el sábado a las 16:00 → cancelación hasta el viernes a las 16:00.';

module.exports = {
  TIMEZONE,
  getCancellationDeadline,
  canCancel,
  formatDeadlineSpanish,
  POLICY_TEXT,
};
