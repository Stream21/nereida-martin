const { Router } = require('express');
const { query, getClient } = require('../db/pool');
const validateBooking = require('../middleware/validateBooking');

const router = Router();

router.post('/', validateBooking, async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { treatmentId, startTime, clientName, clientEmail, clientPhone } = req.body;

    const treatmentResult = await client.query(
      'SELECT id, name, tag, duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
      [treatmentId]
    );

    if (treatmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    const treatment = treatmentResult.rows[0];
    const blockDuration = treatment.duration_max || treatment.duration_min;

    const start = new Date(startTime);
    const end = new Date(start.getTime() + blockDuration * 60000);

    const conflictResult = await client.query(
      `SELECT id FROM bookings
       WHERE status = 'confirmed'
         AND start_time < $2
         AND end_time > $1`,
      [start.toISOString(), end.toISOString()]
    );

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Horario no disponible',
        message: 'Este horario ya ha sido reservado. Por favor selecciona otro.',
      });
    }

    const clientResult = await client.query(
      `INSERT INTO clients (name, email, phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = $1, phone = COALESCE($3, clients.phone)
       RETURNING id`,
      [clientName.trim(), clientEmail.trim().toLowerCase(), clientPhone || null]
    );
    const clientId = clientResult.rows[0].id;

    const bookingResult = await client.query(
      `INSERT INTO bookings (client_id, treatment_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING id, start_time, end_time, status, created_at`,
      [clientId, treatmentId, start.toISOString(), end.toISOString()]
    );
    const booking = bookingResult.rows[0];

    await client.query('COMMIT');

    let googleEventId = null;
    try {
      const googleCalendar = require('../services/googleCalendar');
      googleEventId = await googleCalendar.createEvent({
        summary: `${treatment.name} – ${clientName}`,
        description: `Tratamiento: ${treatment.name}\nDetalle: ${treatment.tag}\nCliente: ${clientName}\nEmail: ${clientEmail}\nTel: ${clientPhone || 'N/A'}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        clientEmail,
      });

      if (googleEventId) {
        await query(
          'UPDATE bookings SET google_event_id = $1 WHERE id = $2',
          [googleEventId, booking.id]
        );
      }
    } catch (err) {
      console.error('Google Calendar event creation failed (non-blocking):', err.message);
    }

    let emailSent = false;
    try {
      const emailService = require('../services/emailService');
      await emailService.sendConfirmation({
        to: clientEmail,
        clientName,
        treatment,
        startTime: start,
        endTime: end,
        bookingId: booking.id,
      });
      emailSent = true;

      await query(
        'UPDATE bookings SET confirmation_sent = true WHERE id = $1',
        [booking.id]
      );
    } catch (err) {
      console.error('Confirmation email failed (non-blocking):', err.message);
    }

    const calendarFile = require('../services/calendarFile');
    const googleCalendarUrl = calendarFile.generateGoogleCalendarUrl({
      title: `${treatment.name} – Studio Anuelblingding`,
      startTime: start,
      endTime: end,
      description: `${treatment.name}: ${treatment.tag}`,
      location: 'Studio Anuelblingding',
    });

    res.status(201).json({
      booking: {
        id: booking.id,
        treatmentName: treatment.name,
        treatmentTag: treatment.tag,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: booking.status,
      },
      client: { name: clientName, email: clientEmail },
      icsUrl: `${process.env.FRONTEND_URL || ''}/api/bookings/${booking.id}/calendar`,
      googleCalendarUrl,
      emailSent,
    });
  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23P01') {
      return res.status(409).json({
        error: 'Horario no disponible',
        message: 'Este horario acaba de ser reservado por otra persona.',
      });
    }

    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  } finally {
    client.release();
  }
});

router.get('/:id/calendar', async (req, res) => {
  try {
    const result = await query(
      `SELECT b.start_time, b.end_time, t.name, t.tag, c.name AS client_name
       FROM bookings b
       JOIN treatments t ON b.treatment_id = t.id
       JOIN clients c ON b.client_id = c.id
       WHERE b.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const row = result.rows[0];
    const calendarFile = require('../services/calendarFile');
    const icsContent = calendarFile.generateICS({
      title: `${row.name} – Studio Anuelblingding`,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      description: `${row.name}: ${row.tag}`,
      location: 'Studio Anuelblingding',
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cita-${req.params.id}.ics"`);
    res.send(icsContent);
  } catch (err) {
    console.error('Error generating calendar file:', err);
    res.status(500).json({ error: 'Error al generar archivo de calendario' });
  }
});

module.exports = router;
