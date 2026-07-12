const studioSettings = require('../services/studioSettings');
const { isOnGrid, SLOT_MINUTES } = require('../utils/slotGrid');
const { isWeekendDay, slotFitsInWorkWindows, STUDIO_HOURS_LABEL } = require('../utils/studioHours');
const { formatStudioDate } = require('../utils/studioTimezone');

function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9;
}

async function validateBooking(req, res, next) {
  const { treatmentId, startTime, clientName, clientEmail, clientPhone } = req.body;

  const errors = [];

  if (!treatmentId || typeof treatmentId !== 'string') {
    errors.push('treatmentId es obligatorio');
  }

  if (!startTime || isNaN(Date.parse(startTime))) {
    errors.push('startTime debe ser una fecha ISO válida');
  }

  if (!clientName || typeof clientName !== 'string' || clientName.trim().length < 2) {
    errors.push('clientName es obligatorio (mínimo 2 caracteres)');
  }

  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    errors.push('clientEmail debe ser un email válido');
  }

  if (!isValidPhone(clientPhone)) {
    errors.push('clientPhone es obligatorio (mínimo 9 dígitos)');
  }

  if (startTime) {
    const date = new Date(startTime);
    const dateStr = formatStudioDate(date);

    if (isWeekendDay(dateStr)) {
      errors.push('No se aceptan reservas en fin de semana');
    }

    if (!isOnGrid(date)) {
      errors.push(
        `La hora debe estar en bloques de ${SLOT_MINUTES} minutos (ej. 10:00, 10:15, 10:30)`
      );
    }

    const endProbe = new Date(date.getTime() + SLOT_MINUTES * 60000);
    if (!slotFitsInWorkWindows(dateStr, date.getTime(), endProbe.getTime())) {
      errors.push(`El horario laboral es ${STUDIO_HOURS_LABEL}`);
    }

    if (date <= new Date()) {
      errors.push('La fecha debe ser futura');
    }

    try {
      const bookingStartDate = await studioSettings.getBookingStartDate();
      if (dateStr < bookingStartDate) {
        errors.push(`Las reservas online están disponibles a partir del ${bookingStartDate}`);
      }
    } catch {
      // continue if settings unavailable
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validación fallida', details: errors });
  }

  next();
}

module.exports = validateBooking;
