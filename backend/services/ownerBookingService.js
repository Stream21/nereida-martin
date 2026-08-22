const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const { blockDurationMinutes, SLOT_MINUTES } = require('../utils/slotGrid');
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


function snapDurationMinutes(value, fallback) {
  const raw = Number(value);
  const base = Number.isFinite(raw) && raw > 0 ? raw : fallback;
  return Math.max(SLOT_MINUTES, Math.ceil(base / SLOT_MINUTES) * SLOT_MINUTES);
}

function isGoogleBookingSource(source) {
  return typeof source === 'string' && source.startsWith('google');
}

function isAppManagedSource(source) {
  return !source || source === 'web' || source === 'owner';
}

function hasRealClientEmail(email) {
  return Boolean(email) && email !== 'imported@studio.local';
}

/**
 * Create a confirmed booking for an existing client from the owner panel.
 * Allows inactive micropigmentation treatment.
 */
async function createOwnerBooking({ clientId, treatmentId, startTime, date, time, durationMinutes }) {
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

  // Studio bookings: no public lead-time restriction.

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
    const defaultDuration = blockDurationMinutes(treatment.duration_max || treatment.duration_min);
    const blockDuration = snapDurationMinutes(durationMinutes, defaultDuration);
    const end = new Date(start.getTime() + blockDuration * 60000);

    const dateStr = formatStudioDate(start);
    const timeStr = formatStudioTime(start);
    const slotAvailable = await availabilityService.hasSlotAvailable(
      dateStr,
      timeStr,
      blockDuration,
      null,
      { skipLeadTime: true }
    );
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
    if (hasRealClientEmail(clientRow.email)) {
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
    getJointPersonBlockMinutes,
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

    const personBlock = isJointTreatment(treatmentId)
      ? await getJointPersonBlockMinutes()
      : null;
    const primaryBlock =
      personBlock ||
      blockDurationMinutes(primaryTreatment.duration_max || primaryTreatment.duration_min);
    const companionBlock = personBlock || companionInfo.blockMinutes;
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
         cancel_token, visit_context, joint_role
       ) VALUES ($1, $2, $3, $4, 'confirmed', 'owner', $5, $6, 'primary')
       RETURNING id, start_time, end_time, status`,
      [
        primaryClientId,
        realPrimaryTreatmentId,
        start.toISOString(),
        primaryEnd.toISOString(),
        primaryCancelToken,
        primaryVisitContext,
      ]
    );
    const primaryBooking = primaryBookingRes.rows[0];

    const companionBookingRes = await dbClient.query(
      `INSERT INTO bookings (
         client_id, treatment_id, start_time, end_time, status, source,
         cancel_token, visit_context, joint_role
       ) VALUES ($1, $2, $3, $4, 'confirmed', 'owner', $5, $6, 'companion')
       RETURNING id, start_time, end_time, status`,
      [
        companionClientId,
        companionInfo.companionTreatmentId,
        companionStart.toISOString(),
        companionEnd.toISOString(),
        companionCancelToken,
        companionVisitContext,
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
      `UPDATE bookings SET joint_group_id = $1 WHERE id IN ($2, $3)`,
      [groupId, primaryBooking.id, companionBooking.id]
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

    const frontendUrl = process.env.FRONTEND_URL || '';
    const emailService = require('./emailService');
    const { formatDeadlineSpanish } = require('../utils/cancellationPolicy');

    if (hasRealClientEmail(primaryRow.email)) {
      try {
        await emailService.sendConfirmation({
          to: primaryRow.email,
          clientName: primaryRow.name,
          treatment: { name: primaryTreatment.name, tag: primaryTreatment.tag },
          startTime: start,
          endTime: primaryEnd,
          bookingId: primaryBooking.id,
          cancelUrl: `${frontendUrl}/cancelar/${primaryCancelToken}`,
          cancellationDeadline: formatDeadlineSpanish(start),
        });
        await query('UPDATE bookings SET confirmation_sent = true WHERE id = $1', [primaryBooking.id]);
      } catch (err) {
        console.warn('Owner joint primary confirmation email failed:', err.message);
      }
    }

    if (hasRealClientEmail(companionRow.email)) {
      try {
        await emailService.sendConfirmation({
          to: companionRow.email,
          clientName: companionRow.name,
          treatment: {
            name: companionInfo.companionTreatmentName || companionInfo.treatment?.name || 'Perfilado',
            tag: companionInfo.companionTreatmentTag || companionInfo.treatment?.tag || '',
          },
          startTime: companionStart,
          endTime: companionEnd,
          bookingId: companionBooking.id,
          cancelUrl: `${frontendUrl}/cancelar/${companionCancelToken}`,
          cancellationDeadline: formatDeadlineSpanish(companionStart),
        });
        await query('UPDATE bookings SET confirmation_sent = true WHERE id = $1', [companionBooking.id]);
      } catch (err) {
        console.warn('Owner joint companion confirmation email failed:', err.message);
      }
    }

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


async function updateOwnerBooking(bookingId, { date, time, startTime, treatmentId, durationMinutes } = {}) {
  const bookingRes = await query(
    `SELECT b.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
            t.name AS treatment_name, t.tag AS treatment_tag, t.duration_min, t.duration_max
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (bookingRes.rows.length === 0) {
    return { error: 'Cita no encontrada', status: 404 };
  }
  const booking = bookingRes.rows[0];

  if (booking.status === 'cancelled') {
    return { error: 'Esta cita ya está cancelada', status: 409 };
  }
  if (isGoogleBookingSource(booking.source)) {
    return {
      error: 'Cita de Google Calendar',
      message: 'Las citas de Google solo se pueden editar en Google Calendar.',
      code: 'GOOGLE_READONLY',
      status: 403,
    };
  }
  if (!isAppManagedSource(booking.source)) {
    return { error: 'Solo se pueden modificar citas creadas con la aplicación', status: 403 };
  }

  const isJoint = Boolean(booking.joint_group_id);
  if (isJoint && (treatmentId || durationMinutes != null)) {
    return {
      error:
        'En citas conjuntas no se puede cambiar el tratamiento ni la duración. Cancela y crea de nuevo.',
      code: 'JOINT_LOCKED',
      status: 400,
    };
  }

  let start;
  if (date && time) {
    const [hour, minute] = String(time).split(':').map(Number);
    const { studioLocalToDate } = require('../utils/studioTimezone');
    start = studioLocalToDate(date, hour, minute || 0);
  } else if (startTime) {
    start = new Date(startTime);
  } else {
    start = new Date(booking.start_time);
  }
  if (isNaN(start.getTime())) {
    return { error: 'Fecha u hora no válida', status: 400 };
  }

  let newTreatmentId = booking.treatment_id;
  let treatmentName = booking.treatment_name;
  let treatmentTag = booking.treatment_tag;
  let durationMin = booking.duration_min;
  let durationMax = booking.duration_max;

  if (treatmentId && treatmentId !== booking.treatment_id) {
    const treatmentRes = await query(
      `SELECT id, name, tag, duration_min, duration_max
       FROM treatments
       WHERE id = $1 AND (active = true OR id = 'micropigmentacion-soft-pixel')`,
      [treatmentId]
    );
    if (treatmentRes.rows.length === 0) {
      return { error: 'Tratamiento no encontrado', status: 404 };
    }
    const t = treatmentRes.rows[0];
    newTreatmentId = t.id;
    treatmentName = t.name;
    treatmentTag = t.tag;
    durationMin = t.duration_min;
    durationMax = t.duration_max;
  }

  const defaultDuration = blockDurationMinutes(durationMax || durationMin || 60);
  const currentDuration = Math.round(
    (new Date(booking.end_time) - new Date(booking.start_time)) / 60000
  );
  const blockDuration = snapDurationMinutes(
    durationMinutes != null
      ? durationMinutes
      : treatmentId && treatmentId !== booking.treatment_id
        ? defaultDuration
        : currentDuration || defaultDuration,
    defaultDuration
  );

  if (isJoint) {
    const {
      getJointPersonBlockMinutes,
      syncGoogleCalendarForBooking,
    } = require('./jointBookingService');
    const { findPerfiladoWeekConflict } = require('../utils/perfiladoSpacing');

    const groupRes = await query(
      `SELECT * FROM joint_booking_groups WHERE id = $1`,
      [booking.joint_group_id]
    );
    if (groupRes.rows.length === 0) {
      return { error: 'Grupo conjunto no encontrado', status: 404 };
    }
    const group = groupRes.rows[0];
    const personBlock = await getJointPersonBlockMinutes();
    const primaryStart = start;
    const primaryEnd = new Date(primaryStart.getTime() + personBlock * 60000);
    const companionStart = primaryEnd;
    const companionEnd = new Date(companionStart.getTime() + personBlock * 60000);
    const fullEnd = companionEnd;

    const overlap = await query(
      `SELECT id FROM bookings
       WHERE status IN ('confirmed', 'pending_review', 'pending_companion', 'google_overlap')
         AND start_time < $2 AND end_time > $1
         AND id != ALL($3::int[])
       LIMIT 1`,
      [
        primaryStart.toISOString(),
        fullEnd.toISOString(),
        [group.primary_booking_id, group.companion_booking_id],
      ]
    );
    if (overlap.rows.length > 0) {
      return { error: 'Horario no disponible', status: 409 };
    }

    const primaryBookingRes = await query(
      `SELECT client_id, treatment_id FROM bookings WHERE id = $1`,
      [group.primary_booking_id]
    );
    const companionBookingRes = await query(
      `SELECT client_id, treatment_id FROM bookings WHERE id = $1`,
      [group.companion_booking_id]
    );
    const primaryClash = await findPerfiladoWeekConflict({
      clientId: primaryBookingRes.rows[0].client_id,
      treatmentId: primaryBookingRes.rows[0].treatment_id,
      startTime: primaryStart,
      excludeBookingId: group.primary_booking_id,
    });
    if (primaryClash) return { ...primaryClash, status: 409 };
    const companionClash = await findPerfiladoWeekConflict({
      clientId: companionBookingRes.rows[0].client_id,
      treatmentId: companionBookingRes.rows[0].treatment_id,
      startTime: companionStart,
      excludeBookingId: group.companion_booking_id,
    });
    if (companionClash) return { ...companionClash, status: 409 };

    await query(
      `UPDATE bookings SET start_time = $1, end_time = $2, last_sync_source = 'owner', updated_at = NOW()
       WHERE id = $3`,
      [primaryStart.toISOString(), primaryEnd.toISOString(), group.primary_booking_id]
    );
    await query(
      `UPDATE bookings SET start_time = $1, end_time = $2, last_sync_source = 'owner', updated_at = NOW()
       WHERE id = $3`,
      [companionStart.toISOString(), companionEnd.toISOString(), group.companion_booking_id]
    );

    await syncGoogleCalendarForBooking(group.primary_booking_id);
    await syncGoogleCalendarForBooking(group.companion_booking_id);

    const legs = await query(
      `SELECT b.id, b.start_time, b.end_time, c.name AS client_name, c.email AS client_email,
              t.name AS treatment_name, t.tag AS treatment_tag
       FROM bookings b
       JOIN clients c ON c.id = b.client_id
       LEFT JOIN treatments t ON t.id = b.treatment_id
       WHERE b.joint_group_id = $1
       ORDER BY b.start_time ASC`,
      [booking.joint_group_id]
    );
    const emailService = require('./emailService');
    for (const leg of legs.rows) {
      if (!hasRealClientEmail(leg.client_email)) continue;
      try {
        await emailService.sendGoogleChangeNotice({
          to: leg.client_email,
          clientName: leg.client_name,
          treatment: { name: leg.treatment_name || 'Cita', tag: leg.treatment_tag || '' },
          startTime: new Date(leg.start_time),
          endTime: new Date(leg.end_time),
          changeType: 'rescheduled',
        });
      } catch (err) {
        console.warn('Owner joint reschedule email failed:', err.message);
      }
    }

    const dashboard = require('./ownerDashboardService');
    const updated = await dashboard.getBookingDetail(bookingId);
    return { booking: updated };
  }

  const end = new Date(start.getTime() + blockDuration * 60000);
  const dateStr = formatStudioDate(start);
  const timeStr = formatStudioTime(start);
  const slotAvailable = await availabilityService.hasSlotAvailable(
    dateStr,
    timeStr,
    blockDuration,
    booking.id,
    { skipLeadTime: true }
  );
  if (!slotAvailable) {
    return { error: 'Horario no disponible', status: 409 };
  }

  const { findPerfiladoWeekConflict } = require('../utils/perfiladoSpacing');
  const perfiladoClash = await findPerfiladoWeekConflict({
    clientId: booking.client_id,
    treatmentId: newTreatmentId,
    startTime: start,
    excludeBookingId: booking.id,
  });
  if (perfiladoClash) {
    return { ...perfiladoClash, status: 409 };
  }

  await query(
    `UPDATE bookings SET start_time = $1, end_time = $2, treatment_id = $3,
     last_sync_source = 'owner', updated_at = NOW()
     WHERE id = $4`,
    [start.toISOString(), end.toISOString(), newTreatmentId, booking.id]
  );

  if (booking.google_event_id) {
    try {
      const googleCalendar = require('./googleCalendar');
      const event = await googleCalendar.updateEvent(booking.google_event_id, {
        summary: buildBookingSummary({
          treatmentName: treatmentName || 'Cita',
          clientName: booking.client_name,
        }),
        description: buildBookingDescription({
          treatmentName: treatmentName || 'Cita',
          treatmentTag: treatmentTag || '',
          clientName: booking.client_name,
          clientEmail: booking.client_email,
          clientPhone: booking.client_phone,
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
        [
          event.etag || null,
          event.updated ? new Date(event.updated).toISOString() : null,
          booking.id,
        ]
      );
    } catch (err) {
      console.warn('Owner booking Google update failed:', err.message);
    }
  }

  if (hasRealClientEmail(booking.client_email)) {
    try {
      const emailService = require('./emailService');
      await emailService.sendGoogleChangeNotice({
        to: booking.client_email,
        clientName: booking.client_name,
        treatment: { name: treatmentName || 'Cita', tag: treatmentTag || '' },
        startTime: start,
        endTime: end,
        changeType: 'rescheduled',
      });
    } catch (err) {
      console.warn('Owner reschedule email failed:', err.message);
    }
  }

  const dashboard = require('./ownerDashboardService');
  const updated = await dashboard.getBookingDetail(booking.id);
  return { booking: updated };
}

async function cancelOwnerBooking(bookingId) {
  const bookingRes = await query(
    `SELECT b.*, c.name AS client_name, c.email AS client_email,
            t.name AS treatment_name, t.tag AS treatment_tag
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (bookingRes.rows.length === 0) {
    return { error: 'Cita no encontrada', status: 404 };
  }
  const booking = bookingRes.rows[0];

  if (booking.status === 'cancelled') {
    return { ok: true, alreadyCancelled: true };
  }
  if (isGoogleBookingSource(booking.source)) {
    return {
      error: 'Cita de Google Calendar',
      message: 'Las citas de Google solo se pueden cancelar en Google Calendar.',
      code: 'GOOGLE_READONLY',
      status: 403,
    };
  }
  if (!isAppManagedSource(booking.source)) {
    return { error: 'Solo se pueden cancelar citas creadas con la aplicación', status: 403 };
  }

  const emailService = require('./emailService');

  if (booking.joint_group_id) {
    const {
      cancelJointGroupBookings,
    } = require('./jointBookingService');
    const groupBookings = await query(
      `SELECT b.start_time, b.end_time, c.name AS client_name, c.email AS client_email,
              t.name AS treatment_name, t.tag AS treatment_tag
       FROM bookings b
       JOIN clients c ON c.id = b.client_id
       LEFT JOIN treatments t ON t.id = b.treatment_id
       WHERE b.joint_group_id = $1`,
      [booking.joint_group_id]
    );
    await cancelJointGroupBookings(booking.joint_group_id, { notify: false });

    for (const row of groupBookings.rows || []) {
      const to = row.client_email;
      if (!hasRealClientEmail(to)) continue;
      try {
        await emailService.sendCancellationConfirmation({
          to,
          clientName: row.client_name || row.name,
          treatment: {
            name: row.treatment_name || booking.treatment_name || 'Cita',
            tag: row.treatment_tag || '',
          },
          startTime: new Date(row.start_time),
          endTime: new Date(row.end_time),
        });
      } catch (err) {
        console.warn('Owner joint cancel email failed:', err.message);
      }
    }

    return { ok: true, joint: true };
  }

  await query(
    `UPDATE bookings SET status = 'cancelled', last_sync_source = 'owner', updated_at = NOW()
     WHERE id = $1`,
    [booking.id]
  );

  if (booking.google_event_id) {
    try {
      const googleCalendar = require('./googleCalendar');
      await googleCalendar.deleteEvent(booking.google_event_id);
    } catch (err) {
      console.warn('Owner cancel Google delete failed:', err.message);
    }
  }

  if (hasRealClientEmail(booking.client_email)) {
    try {
      await emailService.sendCancellationConfirmation({
        to: booking.client_email,
        clientName: booking.client_name,
        treatment: {
          name: booking.treatment_name || 'Cita',
          tag: booking.treatment_tag || '',
        },
        startTime: new Date(booking.start_time),
        endTime: new Date(booking.end_time),
      });
    } catch (err) {
      console.warn('Owner cancel email failed:', err.message);
    }
  }

  return { ok: true };
}

module.exports = {
  createOwnerBooking,
  createOwnerJointBooking,
  updateOwnerBooking,
  cancelOwnerBooking,
  snapDurationMinutes,
  STUDIO_BRAND,
};
