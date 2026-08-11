const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const { blockDurationMinutes } = require('../utils/slotGrid');
const availabilityService = require('./availabilityService');
const { formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');
const { isBeforeMinLead, MIN_BOOKING_LEAD_HOURS } = require('../utils/bookingLeadTime');
const {
  buildBookingSummary,
  buildBookingDescription,
  getEventColorId,
} = require('../utils/webCalendarEvent');
const { STUDIO_BRAND } = require('../utils/studioBrand');
const { resolveVisitContext, isFirstStudioVisit, hasTreatmentBefore } = require('./clientService');

/**
 * Create a confirmed booking for an existing client from the owner panel.
 * Allows inactive micropigmentation treatment.
 */
async function createOwnerBooking({ clientId, treatmentId, startTime, date, time }) {
  let start;
  if (date && time) {
    const [hour, minute] = String(time).split(':').map(Number);
    const { studioLocalToDate } = require('../utils/studioTimezone');
    start = studioLocalToDate(date, hour, minute || 0);
  } else {
    start = new Date(startTime);
  }
  if (isNaN(start.getTime())) {
    return { error: 'startTime no válido', status: 400 };
  }

  if (isBeforeMinLead(start.getTime())) {
    return {
      error: `Las citas requieren al menos ${MIN_BOOKING_LEAD_HOURS} horas de antelación`,
      status: 400,
      code: 'LEAD_TIME',
    };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const clientRes = await client.query(
      `SELECT id, name, email, phone FROM clients WHERE id = $1 FOR UPDATE`,
      [clientId]
    );
    if (clientRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Cliente no encontrado', status: 404 };
    }
    const clientRow = clientRes.rows[0];

    const treatmentRes = await client.query(
      `SELECT id, name, tag, category, duration_min, duration_max, active
       FROM treatments
       WHERE id = $1 AND (active = true OR id = 'micropigmentacion-soft-pixel')`,
      [treatmentId]
    );
    if (treatmentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Tratamiento no encontrado', status: 404 };
    }
    const treatment = treatmentRes.rows[0];
    const blockDuration = blockDurationMinutes(treatment.duration_max || treatment.duration_min);
    const end = new Date(start.getTime() + blockDuration * 60000);

    const dateStr = formatStudioDate(start);
    const timeStr = formatStudioTime(start);
    const slotAvailable = await availabilityService.hasSlotAvailable(dateStr, timeStr, blockDuration);
    if (!slotAvailable) {
      await client.query('ROLLBACK');
      return {
        error: 'Horario no disponible',
        message: 'Este horario ya está ocupado o no es válido.',
        status: 409,
      };
    }

    const firstStudio = await isFirstStudioVisit(clientId);
    const hadTreatment = await hasTreatmentBefore(clientId, treatmentId);
    const visitContext = resolveVisitContext({
      isFirstStudio: firstStudio,
      isFirstTreatment: !hadTreatment,
    });

    const cancelToken = uuidv4();
    const bookingResult = await client.query(
      `INSERT INTO bookings (
         client_id, treatment_id, start_time, end_time, status, source, cancel_token, visit_context
       )
       VALUES ($1, $2, $3, $4, 'confirmed', 'owner', $5, $6)
       RETURNING id, start_time, end_time, status, cancel_token`,
      [clientId, treatmentId, start.toISOString(), end.toISOString(), cancelToken, visitContext]
    );
    const booking = bookingResult.rows[0];

    await client.query(
      `UPDATE clients SET
         first_booking_at = COALESCE(first_booking_at, NOW()),
         last_booking_at = NOW()
       WHERE id = $1`,
      [clientId]
    );

    await client.query('COMMIT');

    // Google Calendar sync (best effort)
    try {
      const googleCalendar = require('./googleCalendar');
      const summary = buildBookingSummary({
        treatmentName: treatment.name,
        clientName: clientRow.name,
        visitContext,
      });
      const description = buildBookingDescription({
        treatmentName: treatment.name,
        treatmentTag: treatment.tag,
        clientName: clientRow.name,
        clientEmail: clientRow.email,
        clientPhone: clientRow.phone,
        bookingId: booking.id,
        visitContext,
      });
      const colorId = getEventColorId({ visitContext });
      const event = await googleCalendar.createEvent({
        summary,
        description,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        clientEmail: clientRow.email,
        isWebBooking: true,
        bookingId: booking.id,
        colorId,
      });
      if (event?.id) {
        await query(
          `UPDATE bookings SET google_event_id = $1, google_etag = $2, google_updated_at = $3,
           last_sync_source = 'owner', updated_at = NOW()
           WHERE id = $4 AND google_event_id IS NULL`,
          [
            event.id,
            event.etag || null,
            event.updated ? new Date(event.updated).toISOString() : null,
            booking.id,
          ]
        );
      }
    } catch (err) {
      console.warn('Owner booking Google sync failed:', err.message);
    }

    // Confirmation email if client has email
    if (clientRow.email && clientRow.email !== 'imported@studio.local') {
      try {
        const emailService = require('./emailService');
        const frontendUrl = process.env.FRONTEND_URL || '';
        const { formatDeadlineSpanish } = require('../utils/cancellationPolicy');
        await emailService.sendConfirmation({
          to: clientRow.email,
          clientName: clientRow.name,
          treatment: { name: treatment.name, tag: treatment.tag },
          startTime: start,
          endTime: end,
          bookingId: booking.id,
          cancelUrl: `${frontendUrl}/cancelar/${cancelToken}`,
          cancellationDeadline: formatDeadlineSpanish(start),
        });
        await query('UPDATE bookings SET confirmation_sent = true WHERE id = $1', [booking.id]);
      } catch (err) {
        console.warn('Owner booking confirmation email failed:', err.message);
      }
    }

    return {
      booking: {
        id: booking.id,
        startTime: booking.start_time,
        endTime: booking.end_time,
        status: booking.status,
        treatmentName: treatment.name,
        clientName: clientRow.name,
        clientId,
      },
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    if (err.code === '23P01') {
      return { error: 'Horario no disponible (solape)', status: 409 };
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createOwnerBooking, STUDIO_BRAND };
