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

    if (treatmentId === 'micropigmentacion-soft-pixel') {
      await client.query(
        `UPDATE henna_assessments
         SET booking_id = $1
         WHERE client_id = $2
           AND booking_id IS NULL
           AND photo_path LIKE 'micro-requests/%'`,
        [booking.id, clientId]
      );
    }

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

async function createOwnerJointBooking({
  primaryClientId,
  companionClientId,
  treatmentId,
  startTime,
  date,
  time,
}) {
  const { isPerfiladoTreatment } = require('../utils/perfiladoSpacing');
  const {
    resolveCompanionTreatment,
    resolvePrimaryTreatment,
    isJointTreatment,
    syncGoogleCalendarForBooking,
  } = require('./jointBookingService');

  if (!isPerfiladoTreatment(treatmentId) && !isJointTreatment(treatmentId)) {
    return { error: 'Solo disponible para perfilado', status: 400, code: 'NOT_PERFILADO' };
  }

  if (primaryClientId === companionClientId) {
    return { error: 'La acompañante debe ser otra clienta', status: 400, code: 'SAME_CLIENT' };
  }

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

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const primaryRes = await dbClient.query(
      `SELECT id, name, email, phone, account_status FROM clients WHERE id = $1 FOR UPDATE`,
      [primaryClientId]
    );
    if (primaryRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return { error: 'Cliente principal no encontrado', status: 404 };
    }
    const primaryRow = primaryRes.rows[0];
    if (primaryRow.account_status !== 'active') {
      await dbClient.query('ROLLBACK');
      return { error: 'La clienta principal debe estar activa', status: 403 };
    }

    const companionRes = await dbClient.query(
      `SELECT id, name, email, phone, account_status FROM clients WHERE id = $1 FOR UPDATE`,
      [companionClientId]
    );
    if (companionRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return { error: 'Acompañante no encontrada', status: 404 };
    }
    const companionRow = companionRes.rows[0];
    if (companionRow.account_status !== 'active') {
      await dbClient.query('ROLLBACK');
      return { error: 'La acompañante debe estar activa', status: 403 };
    }

    let primaryTreatment;
    let realPrimaryTreatmentId = treatmentId;

    if (isJointTreatment(treatmentId)) {
      const primaryInfo = await resolvePrimaryTreatment(primaryClientId);
      if (primaryInfo.error) {
        await dbClient.query('ROLLBACK');
        return primaryInfo;
      }
      realPrimaryTreatmentId = primaryInfo.companionTreatmentId;
      primaryTreatment = primaryInfo.treatment;
    } else {
      const treatmentRes = await dbClient.query(
        `SELECT id, name, tag, duration_min, duration_max FROM treatments
         WHERE id = $1 AND active = true`,
        [treatmentId]
      );
      if (treatmentRes.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return { error: 'Tratamiento no encontrado', status: 404 };
      }
      primaryTreatment = treatmentRes.rows[0];
    }

    const companionInfo = await resolveCompanionTreatment(companionClientId);
    if (companionInfo.error) {
      await dbClient.query('ROLLBACK');
      return companionInfo;
    }

    const primaryBlock = blockDurationMinutes(
      primaryTreatment.duration_max || primaryTreatment.duration_min
    );
    const companionBlock = companionInfo.blockMinutes;
    const primaryEnd = new Date(start.getTime() + primaryBlock * 60000);
    const companionStart = primaryEnd;
    const companionEnd = new Date(companionStart.getTime() + companionBlock * 60000);

    const dateStr = formatStudioDate(start);
    const timeStr = formatStudioTime(start);
    const slotOk = await availabilityService.hasJointSlotAvailable(
      dateStr,
      timeStr,
      treatmentId,
      companionClientId,
      primaryClientId,
      { skipPerfiladoLimit: true, skipLeadTime: true }
    );
    if (!slotOk) {
      await dbClient.query('ROLLBACK');
      return {
        error: 'Horario no disponible',
        message: 'Este hueco conjunto ya está ocupado o no es válido.',
        status: 409,
      };
    }

    const primaryFirstStudio = await isFirstStudioVisit(primaryClientId);
    const primaryHadTreatment = await hasTreatmentBefore(primaryClientId, realPrimaryTreatmentId);
    const primaryVisitContext = resolveVisitContext({
      isFirstStudio: primaryFirstStudio,
      isFirstTreatment: !primaryHadTreatment,
    });

    const companionFirstStudio = await isFirstStudioVisit(companionClientId);
    const companionHadTreatment = await hasTreatmentBefore(
      companionClientId,
      companionInfo.companionTreatmentId
    );
    const companionVisitContext = resolveVisitContext({
      isFirstStudio: companionFirstStudio,
      isFirstTreatment: !companionHadTreatment,
    });

    const groupId = uuidv4();
    const confirmToken = uuidv4();
    const primaryCancelToken = uuidv4();
    const companionCancelToken = uuidv4();

    const primaryBookingRes = await dbClient.query(
      `INSERT INTO bookings (
         client_id, treatment_id, start_time, end_time, status, source,
         cancel_token, visit_context, joint_group_id, joint_role
       ) VALUES ($1, $2, $3, $4, 'confirmed', 'owner', $5, $6, $7, 'primary')
       RETURNING id, start_time, end_time, status`,
      [
        primaryClientId,
        realPrimaryTreatmentId,
        start.toISOString(),
        primaryEnd.toISOString(),
        primaryCancelToken,
        primaryVisitContext,
        groupId,
      ]
    );
    const primaryBooking = primaryBookingRes.rows[0];

    const companionBookingRes = await dbClient.query(
      `INSERT INTO bookings (
         client_id, treatment_id, start_time, end_time, status, source,
         cancel_token, visit_context, joint_group_id, joint_role
       ) VALUES ($1, $2, $3, $4, 'confirmed', 'owner', $5, $6, $7, 'companion')
       RETURNING id, start_time, end_time, status`,
      [
        companionClientId,
        companionInfo.companionTreatmentId,
        companionStart.toISOString(),
        companionEnd.toISOString(),
        companionCancelToken,
        companionVisitContext,
        groupId,
      ]
    );
    const companionBooking = companionBookingRes.rows[0];

    await dbClient.query(
      `INSERT INTO joint_booking_groups (
         id, primary_booking_id, companion_booking_id, companion_client_id,
         status, confirm_token, expires_at, confirmed_at
       ) VALUES ($1, $2, $3, $4, 'confirmed', $5, NOW(), NOW())`,
      [
        groupId,
        primaryBooking.id,
        companionBooking.id,
        companionClientId,
        confirmToken,
      ]
    );

    await dbClient.query(
      `UPDATE clients SET
         first_booking_at = COALESCE(first_booking_at, NOW()),
         last_booking_at = NOW()
       WHERE id IN ($1, $2)`,
      [primaryClientId, companionClientId]
    );

    await dbClient.query('COMMIT');

    await syncGoogleCalendarForBooking(primaryBooking.id);
    await syncGoogleCalendarForBooking(companionBooking.id);

    return {
      jointBooking: true,
      primaryBooking: {
        id: primaryBooking.id,
        startTime: primaryBooking.start_time,
        endTime: primaryBooking.end_time,
        status: primaryBooking.status,
        treatmentName: primaryTreatment.name,
        clientName: primaryRow.name,
        clientId: primaryClientId,
      },
      companionBooking: {
        id: companionBooking.id,
        startTime: companionBooking.start_time,
        endTime: companionBooking.end_time,
        status: companionBooking.status,
        treatmentName: companionInfo.companionTreatmentName,
        clientName: companionRow.name,
        clientId: companionClientId,
      },
    };
  } catch (err) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    if (err.code === '23P01') {
      return { error: 'Horario no disponible (solape)', status: 409 };
    }
    throw err;
  } finally {
    dbClient.release();
  }
}

module.exports = { createOwnerBooking, createOwnerJointBooking, STUDIO_BRAND };
