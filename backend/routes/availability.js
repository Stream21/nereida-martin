const { Router } = require('express');
const { query } = require('../db/pool');
const studioSettings = require('../services/studioSettings');

const router = Router();

const OPEN_HOUR = 10;
const CLOSE_HOUR = 20;
const SLOT_INCREMENT = 30;

router.get('/', async (req, res) => {
  try {
    const { date, treatmentId } = req.query;

    if (!date || !treatmentId) {
      return res.status(400).json({ error: 'date y treatmentId son obligatorios' });
    }

    const parsedDate = new Date(`${date}T12:00:00`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }

    const bookingStartDate = await studioSettings.getBookingStartDate();
    const bookingStart = new Date(`${bookingStartDate}T00:00:00`);
    if (parsedDate < bookingStart) {
      return res.json({ slots: [], date, treatmentId, bookingStartDate });
    }

    const day = parsedDate.getDay();
    if (day === 0 || day === 6) {
      return res.json({ slots: [], date, treatmentId, bookingStartDate });
    }

    const treatmentResult = await query(
      'SELECT duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
      [treatmentId]
    );

    if (treatmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    const treatment = treatmentResult.rows[0];
    const blockDuration = treatment.duration_max || treatment.duration_min;

    const dateStr = date;
    const dayStart = new Date(`${dateStr}T${String(OPEN_HOUR).padStart(2, '0')}:00:00`);
    const dayEnd = new Date(`${dateStr}T${String(CLOSE_HOUR).padStart(2, '0')}:00:00`);

    const bookingsResult = await query(
      `SELECT start_time, end_time FROM bookings
       WHERE status = 'confirmed'
         AND start_time >= $1
         AND start_time < $2`,
      [dayStart.toISOString(), dayEnd.toISOString()]
    );

    const bookedRanges = bookingsResult.rows.map((b) => ({
      start: new Date(b.start_time).getTime(),
      end: new Date(b.end_time).getTime(),
    }));

    let googleBusyRanges = [];
    try {
      const googleCalendar = require('../services/googleCalendar');
      googleBusyRanges = await googleCalendar.getFreeBusy(dateStr);
    } catch {
      // Google Calendar not configured yet - continue without it
    }

    const allBusyRanges = [...bookedRanges, ...googleBusyRanges];

    const now = Date.now();
    const slots = [];
    const cursor = new Date(dayStart);

    while (cursor.getTime() + blockDuration * 60000 <= dayEnd.getTime()) {
      const slotStart = cursor.getTime();
      const slotEnd = slotStart + blockDuration * 60000;

      const isPast = slotStart <= now;

      const hasConflict = allBusyRanges.some(
        (range) => slotStart < range.end && slotEnd > range.start
      );

      const timeStr = `${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`;

      slots.push({
        time: timeStr,
        available: !isPast && !hasConflict,
      });

      cursor.setMinutes(cursor.getMinutes() + SLOT_INCREMENT);
    }

    res.json({ slots, date: dateStr, treatmentId, bookingStartDate });
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

module.exports = router;
