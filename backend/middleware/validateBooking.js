const studioSettings = require('../services/studioSettings');

async function validateBooking(req, res, next) {
  const { treatmentId, startTime, clientName, clientEmail } = req.body;

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

  if (startTime) {
    const date = new Date(startTime);
    const day = date.getDay();
    if (day === 0 || day === 6) {
      errors.push('No se aceptan reservas en fin de semana');
    }

    const hours = date.getHours();
    if (hours < 10 || hours >= 20) {
      errors.push('El horario laboral es de 10:00 a 20:00');
    }

    if (date <= new Date()) {
      errors.push('La fecha debe ser futura');
    }

    try {
      const bookingStartDate = await studioSettings.getBookingStartDate();
      const bookingStart = new Date(`${bookingStartDate}T00:00:00`);
      const appointmentDay = new Date(date.toISOString().split('T')[0] + 'T00:00:00');
      if (appointmentDay < bookingStart) {
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
