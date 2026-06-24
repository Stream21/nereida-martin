const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const validateBooking = require('../middleware/validateBooking');
const { canCancel, formatDeadlineSpanish, POLICY_TEXT } = require('../utils/cancellationPolicy');
const {
  buildWebBookingSummary,
  buildWebBookingDescription,
} = require('../utils/webCalendarEvent');

const router = Router();

async function fetchBookingByToken(token) {
  const result = await query(
    `SELECT b.id, b.start_time, b.end_time, b.status, b.source, b.cancel_token,
            b.google_event_id, t.name AS treatment_name, t.tag AS treatment_tag,
            c.name AS client_name, c.email AS client_email
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE b.cancel_token = $1`,
    [token]
  );
  return result.rows[0] || null;
}

function formatBookingResponse(row) {
  const startTime = new Date(row.start_time);
  const endTime = new Date(row.end_time);
  const cancellable = row.status === 'confirmed' && canCancel(startTime);

  return {
    booking: {
      id: row.id,
      treatmentName: row.treatment_name || 'Cita',
      treatmentTag: row.treatment_tag || '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: row.status,
    },
    client: { name: row.client_name, email: row.client_email },
    cancellation: {
      policy: POLICY_TEXT,
      deadline: formatDeadlineSpanish(startTime),
      canCancel: cancellable,
    },
  };
}

router.get('/cancel/:token', async (req, res) => {
  try {
    const row = await fetchBookingByToken(req.params.token);

    if (!row) {
      return res.status(404).json({ error: 'Reserva no encontrada', code: 'INVALID_TOKEN' });
    }

    if (row.status === 'cancelled') {
      return res.status(410).json({
        error: 'Esta reserva ya ha sido cancelada',
        code: 'ALREADY_CANCELLED',
        ...formatBookingResponse(row),
      });
    }

    res.json(formatBookingResponse(row));
  } catch (err) {
    console.error('Error fetching cancel info:', err);
    res.status(500).json({ error: 'Error al obtener la reserva' });
  }
});

router.post('/cancel/:token', async (req, res) => {
  const client = await getClient();

  try {
    const row = await fetchBookingByToken(req.params.token);

    if (!row) {
      return res.status(404).json({ error: 'Reserva no encontrada', code: 'INVALID_TOKEN' });
    }

    if (row.status === 'cancelled') {
      return res.status(410).json({
        error: 'Esta reserva ya ha sido cancelada',
        code: 'ALREADY_CANCELLED',
      });
    }

    const startTime = new Date(row.start_time);

    if (!canCancel(startTime)) {
      return res.status(403).json({
        error: 'Plazo de cancelación expirado',
        code: 'DEADLINE_PASSED',
        message: `Solo puedes cancelar hasta el ${formatDeadlineSpanish(startTime)}. Si necesitas ayuda, contáctanos por WhatsApp.`,
        cancellation: {
          policy: POLICY_TEXT,
          deadline: formatDeadlineSpanish(startTime),
          canCancel: false,
        },
      });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE bookings SET status = 'cancelled', last_sync_source = 'web', updated_at = NOW()
       WHERE id = $1 AND status = 'confirmed'`,
      [row.id]
    );

    await client.query('COMMIT');

    if (row.google_event_id) {
      try {
        const googleCalendar = require('../services/googleCalendar');
        await googleCalendar.deleteEvent(row.google_event_id);
        await query('UPDATE bookings SET sync_pending = false WHERE id = $1', [row.id]);
      } catch (err) {
        console.error('Google Calendar delete failed:', err.message);
        await query('UPDATE bookings SET sync_pending = true WHERE id = $1', [row.id]);
      }
    }

    try {
      const emailService = require('../services/emailService');
      await emailService.sendCancellationConfirmation({
        to: row.client_email,
        clientName: row.client_name,
        treatment: { name: row.treatment_name || 'Cita', tag: row.treatment_tag || '' },
        startTime,
        endTime: new Date(row.end_time),
      });
    } catch (err) {
      console.error('Cancellation email failed:', err.message);
    }

    res.json({
      success: true,
      message: 'Tu cita ha sido cancelada correctamente',
      booking: {
        id: row.id,
        status: 'cancelled',
        startTime: startTime.toISOString(),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cancelling booking:', err);
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res) => {
  const { startTime, treatmentId } = req.body;

  if (!startTime) {
    return res.status(400).json({ error: 'startTime es obligatorio' });
  }

  try {
    const bookingResult = await query(
      `SELECT b.*, c.name AS client_name, c.email AS client_email,
              t.name AS treatment_name, t.tag AS treatment_tag, t.duration_min, t.duration_max
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       LEFT JOIN treatments t ON b.treatment_id = t.id
       WHERE b.id = $1 AND b.status = 'confirmed'`,
      [req.params.id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const booking = bookingResult.rows[0];
    const start = new Date(startTime);

    if (!canCancel(new Date(booking.start_time))) {
      return res.status(403).json({
        error: 'Plazo de modificación expirado',
        message: `Solo puedes modificar hasta el ${formatDeadlineSpanish(new Date(booking.start_time))}.`,
      });
    }

    const blockDuration = booking.duration_max || booking.duration_min || 60;
    const end = new Date(start.getTime() + blockDuration * 60000);

    const conflictResult = await query(
      `SELECT id FROM bookings
       WHERE status = 'confirmed' AND id != $1
         AND start_time < $3 AND end_time > $2`,
      [booking.id, start.toISOString(), end.toISOString()]
    );

    if (conflictResult.rows.length > 0) {
      return res.status(409).json({ error: 'Horario no disponible' });
    }

    const newTreatmentId = treatmentId || booking.treatment_id;

    await query(
      `UPDATE bookings SET start_time = $1, end_time = $2, treatment_id = $3,
       last_sync_source = 'web', updated_at = NOW()
       WHERE id = $4`,
      [start.toISOString(), end.toISOString(), newTreatmentId, booking.id]
    );

    if (booking.google_event_id) {
      try {
        const googleCalendar = require('../services/googleCalendar');
        const event = await googleCalendar.updateEvent(booking.google_event_id, {
          summary: buildWebBookingSummary(booking.treatment_name || 'Cita', booking.client_name),
          description: buildWebBookingDescription({
            treatmentName: booking.treatment_name || 'Cita',
            treatmentTag: booking.treatment_tag || '',
            clientName: booking.client_name,
            clientEmail: booking.client_email,
            bookingId: booking.id,
          }),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          clientEmail: booking.client_email,
          isWebBooking: true,
          bookingId: booking.id,
        });

        await query(
          `UPDATE bookings SET google_etag = $1, google_updated_at = $2 WHERE id = $3`,
          [event.etag || null, event.updated ? new Date(event.updated).toISOString() : null, booking.id]
        );
      } catch (err) {
        console.error('Google Calendar update failed:', err.message);
      }
    }

    res.json({
      booking: {
        id: booking.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'confirmed',
      },
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ error: 'Error al actualizar la reserva' });
  }
});

router.post('/', validateBooking, async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { treatmentId, startTime, clientName, clientEmail, clientPhone } = req.body;
    const cancelToken = uuidv4();

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
      `INSERT INTO bookings (client_id, treatment_id, start_time, end_time, status, source, cancel_token)
       VALUES ($1, $2, $3, $4, 'confirmed', 'web', $5)
       RETURNING id, start_time, end_time, status, cancel_token, created_at`,
      [clientId, treatmentId, start.toISOString(), end.toISOString(), cancelToken]
    );
    const booking = bookingResult.rows[0];

    await client.query('COMMIT');

    let googleEventId = null;
    try {
      const googleCalendar = require('../services/googleCalendar');
      const event = await googleCalendar.createEvent({
        summary: buildWebBookingSummary(treatment.name, clientName),
        description: buildWebBookingDescription({
          treatmentName: treatment.name,
          treatmentTag: treatment.tag,
          clientName,
          clientEmail,
          clientPhone,
          bookingId: booking.id,
        }),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        clientEmail,
        isWebBooking: true,
        bookingId: booking.id,
      });

      googleEventId = event.id;

      if (googleEventId) {
        await query(
          `UPDATE bookings SET google_event_id = $1, google_etag = $2, google_updated_at = $3,
           last_sync_source = 'web', updated_at = NOW()
           WHERE id = $4`,
          [
            googleEventId,
            event.etag || null,
            event.updated ? new Date(event.updated).toISOString() : null,
            booking.id,
          ]
        );
      }
    } catch (err) {
      console.error('Google Calendar event creation failed (non-blocking):', err.message);
    }

    const frontendUrl = process.env.FRONTEND_URL || '';
    const cancelUrl = `${frontendUrl}/cancelar/${cancelToken}`;

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
        cancelUrl,
        cancellationDeadline: formatDeadlineSpanish(start),
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
      cancelUrl,
      cancellationDeadline: formatDeadlineSpanish(start),
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
