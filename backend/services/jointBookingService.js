const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const { IMPORTED_CLIENT_EMAIL } = require('./studioSettings');
const {
  hasTreatmentBefore,
  isFirstStudioVisit,
  resolveVisitContext,
} = require('./clientService');
const { normalizePhone } = require('../utils/phone');
const { blockedWeeksFromBookings, isPerfiladoTreatment } = require('../utils/perfiladoSpacing');
const { blockDurationMinutes } = require('../utils/slotGrid');
const { formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');

const BROW_DESIGN_PRIMERA = 'brow-design-primera';
const BROW_DESIGN_SEGUIMIENTO = 'brow-design-seguimiento';
const BROW_DESIGN_DEFINE = 'brow-define';
const BROW_DESIGN_TRIO = [BROW_DESIGN_PRIMERA, BROW_DESIGN_SEGUIMIENTO, BROW_DESIGN_DEFINE];
const PERFILADO_CONJUNTO_ID = 'perfilado-conjunto';

const JOINT_EXPIRY_HOURS = 24;
const OCCUPIED_STATUSES = ['confirmed', 'pending_review', 'pending_companion', 'google_overlap'];

async function resolveCompanionTreatment(companionClientId) {
  return _resolvePerfiladoForClient(companionClientId);
}

async function resolvePrimaryTreatment(primaryClientId) {
  return _resolvePerfiladoForClient(primaryClientId);
}

async function _resolvePerfiladoForClient(clientId) {
  const treatmentRes = await query(
    `SELECT id, name, tag, duration_min, duration_max, price FROM treatments
     WHERE id IN ($1, $2) AND active = true`,
    [BROW_DESIGN_PRIMERA, BROW_DESIGN_SEGUIMIENTO]
  );
  const byId = Object.fromEntries(treatmentRes.rows.map((r) => [r.id, r]));

  const historyRes = await query(
    `SELECT DISTINCT treatment_id FROM bookings
     WHERE client_id = $1
       AND status IN ('confirmed', 'pending_review', 'pending_companion')
       AND treatment_id = ANY($2::text[])`,
    [clientId, BROW_DESIGN_TRIO]
  );
  const hasHistory = historyRes.rows.length > 0;

  const treatmentId = hasHistory ? BROW_DESIGN_SEGUIMIENTO : BROW_DESIGN_PRIMERA;
  const treatment = byId[treatmentId];
  if (!treatment) {
    return { error: 'Tratamiento de perfilado no disponible', status: 404 };
  }

  return {
    companionTreatmentId: treatmentId,
    companionTreatmentName: treatment.name,
    companionTreatmentTag: treatment.tag,
    blockMinutes: blockDurationMinutes(treatment.duration_max || treatment.duration_min),
    price: treatment.price != null ? Number(treatment.price) : null,
    treatment,
  };
}

async function lookupCompanionByPhone(phone, primaryClientId) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { error: 'Teléfono no válido', status: 400, code: 'INVALID_PHONE' };
  }

  const result = await query(
    `SELECT id, name, email, phone, account_status FROM clients
     WHERE phone_normalized = $1 OR phone = $1`,
    [normalized]
  );

  if (result.rows.length === 0) {
    return {
      error: 'No encontramos una clienta con ese teléfono',
      status: 404,
      code: 'COMPANION_NOT_FOUND',
    };
  }

  const row = result.rows[0];

  if (row.email === IMPORTED_CLIENT_EMAIL) {
    return { error: 'Teléfono no válido para reserva conjunta', status: 400, code: 'INVALID_COMPANION' };
  }

  if (row.id === primaryClientId) {
    return {
      error: 'No puedes reservar contigo misma como acompañante',
      status: 400,
      code: 'SELF_COMPANION',
    };
  }

  if (row.account_status !== 'active') {
    return {
      error: 'La acompañante debe tener cuenta activa en la web',
      status: 403,
      code: 'COMPANION_INACTIVE',
    };
  }

  const treatmentInfo = await resolveCompanionTreatment(row.id);
  if (treatmentInfo.error) return treatmentInfo;

  const bookingsRes = await query(
    `SELECT treatment_id, status, start_time FROM bookings
     WHERE client_id = $1 AND status IN ('confirmed', 'pending_review', 'pending_companion')`,
    [row.id]
  );

  return {
    clientId: row.id,
    name: row.name,
    companionTreatmentId: treatmentInfo.companionTreatmentId,
    companionTreatmentName: treatmentInfo.companionTreatmentName,
    companionTreatmentTag: treatmentInfo.companionTreatmentTag,
    companionBlockMinutes: treatmentInfo.blockMinutes,
    companionPrice: treatmentInfo.price,
    perfiladoBlockedWeeks: blockedWeeksFromBookings(bookingsRes.rows),
  };
}

async function getJointGroupByToken(token) {
  const result = await query(
    `SELECT g.*,
            pb.id AS primary_id, pb.start_time AS primary_start, pb.end_time AS primary_end,
            pb.status AS primary_status, pb.cancel_token AS primary_cancel_token,
            cb.id AS companion_id, cb.start_time AS companion_start, cb.end_time AS companion_end,
            cb.status AS companion_status, cb.cancel_token AS companion_cancel_token,
            pc.name AS primary_name, pc.email AS primary_email,
            cc.name AS companion_name, cc.email AS companion_email,
            pt.name AS primary_treatment_name, pt.tag AS primary_treatment_tag,
            ct.name AS companion_treatment_name, ct.tag AS companion_treatment_tag
     FROM joint_booking_groups g
     JOIN bookings pb ON pb.id = g.primary_booking_id
     JOIN bookings cb ON cb.id = g.companion_booking_id
     JOIN clients pc ON pc.id = pb.client_id
     JOIN clients cc ON cc.id = g.companion_client_id
     LEFT JOIN treatments pt ON pt.id = pb.treatment_id
     LEFT JOIN treatments ct ON ct.id = cb.treatment_id
     WHERE g.confirm_token = $1`,
    [token]
  );
  return result.rows[0] || null;
}

async function confirmJointBooking(token) {
  const group = await getJointGroupByToken(token);
  if (!group) {
    return { error: 'Enlace no válido', status: 404, code: 'INVALID_TOKEN' };
  }

  if (group.status === 'confirmed') {
    return { error: 'Esta cita ya está confirmada', status: 410, code: 'ALREADY_CONFIRMED' };
  }

  if (group.status === 'expired' || group.status === 'cancelled') {
    return { error: 'Esta reserva ha expirado o fue cancelada', status: 410, code: 'EXPIRED' };
  }

  if (new Date(group.expires_at) < new Date()) {
    await expireJointGroup(group.id);
    return { error: 'El plazo de confirmación ha expirado (24 h)', status: 410, code: 'EXPIRED' };
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    await dbClient.query(
      `UPDATE bookings SET status = 'confirmed', updated_at = NOW()
       WHERE id IN ($1, $2) AND status = 'pending_companion'`,
      [group.primary_booking_id, group.companion_booking_id]
    );

    await dbClient.query(
      `UPDATE joint_booking_groups
       SET status = 'confirmed', confirmed_at = NOW()
       WHERE id = $1`,
      [group.id]
    );

    await dbClient.query(
      `UPDATE clients SET
         first_booking_at = COALESCE(first_booking_at, NOW()),
         last_booking_at = NOW()
       WHERE id IN (
         SELECT client_id FROM bookings WHERE id IN ($1, $2)
       )`,
      [group.primary_booking_id, group.companion_booking_id]
    );

    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  return { group, confirmed: true };
}

async function expireJointGroup(groupId) {
  const result = await query(
    `SELECT id, primary_booking_id, companion_booking_id, status
     FROM joint_booking_groups WHERE id = $1`,
    [groupId]
  );
  if (result.rows.length === 0) return null;
  const group = result.rows[0];
  if (group.status !== 'pending_companion') return group;

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    await dbClient.query(
      `UPDATE bookings SET status = 'cancelled', updated_at = NOW()
       WHERE id IN ($1, $2) AND status = 'pending_companion'`,
      [group.primary_booking_id, group.companion_booking_id]
    );
    await dbClient.query(
      `UPDATE joint_booking_groups SET status = 'expired' WHERE id = $1`,
      [groupId]
    );
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  return group;
}

async function expirePendingJointGroups() {
  const result = await query(
    `SELECT id FROM joint_booking_groups
     WHERE status = 'pending_companion' AND expires_at < NOW()`
  );

  const expired = [];
  for (const row of result.rows) {
    const group = await expireJointGroup(row.id);
    if (group) expired.push(group);
  }
  return expired;
}

async function cancelJointGroupBookings(jointGroupId, { notify = true } = {}) {
  const groupRes = await query(
    `SELECT g.*,
            pb.cancel_token AS primary_cancel_token, pb.google_event_id AS primary_google_id,
            cb.cancel_token AS companion_cancel_token, cb.google_event_id AS companion_google_id,
            pc.email AS primary_email, pc.name AS primary_name,
            cc.email AS companion_email, cc.name AS companion_name
     FROM joint_booking_groups g
     JOIN bookings pb ON pb.id = g.primary_booking_id
     JOIN bookings cb ON cb.id = g.companion_booking_id
     JOIN clients pc ON pc.id = pb.client_id
     JOIN clients cc ON cc.id = g.companion_client_id
     WHERE g.id = $1`,
    [jointGroupId]
  );
  if (groupRes.rows.length === 0) return null;
  const group = groupRes.rows[0];

  await query(
    `UPDATE bookings SET status = 'cancelled', updated_at = NOW()
     WHERE joint_group_id = $1 AND status IN ('confirmed', 'pending_companion', 'pending_review')`,
    [jointGroupId]
  );

  await query(
    `UPDATE joint_booking_groups SET status = 'cancelled' WHERE id = $1`,
    [jointGroupId]
  );

  const googleCalendar = require('./googleCalendar');
  for (const eventId of [group.primary_google_id, group.companion_google_id]) {
    if (!eventId) continue;
    try {
      await googleCalendar.deleteEvent(eventId);
    } catch (err) {
      console.warn('Joint cancel Google delete failed:', err.message);
    }
  }

  return group;
}

async function getJointBookingsForGroup(jointGroupId) {
  const result = await query(
    `SELECT b.*, c.name AS client_name, t.name AS treatment_name
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE b.joint_group_id = $1
     ORDER BY b.start_time ASC`,
    [jointGroupId]
  );
  return result.rows;
}

async function createWebJointBooking({
  dbClient,
  primaryClientId,
  companionClientId,
  primaryTreatmentId,
  startTime,
  visitContext,
}) {
  const availabilityService = require('./availabilityService');
  const { blockDurationMinutes } = require('../utils/slotGrid');
  const { formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');

  let realPrimaryTreatmentId = primaryTreatmentId;
  let primaryTreatment;

  if (isJointTreatment(primaryTreatmentId)) {
    const primaryInfo = await resolvePrimaryTreatment(primaryClientId);
    if (primaryInfo.error) return primaryInfo;
    realPrimaryTreatmentId = primaryInfo.companionTreatmentId;
    primaryTreatment = primaryInfo.treatment;
  } else {
    const primaryTreatmentRes = await dbClient.query(
      'SELECT id, name, tag, duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
      [primaryTreatmentId]
    );
    if (primaryTreatmentRes.rows.length === 0) {
      return { error: 'Tratamiento no encontrado', status: 404 };
    }
    primaryTreatment = primaryTreatmentRes.rows[0];
  }

  const companionInfo = await resolveCompanionTreatment(companionClientId);
  if (companionInfo.error) return companionInfo;

  const primaryBlock = blockDurationMinutes(
    primaryTreatment.duration_max || primaryTreatment.duration_min
  );
  const companionBlock = companionInfo.blockMinutes;

  const start = new Date(startTime);
  const primaryEnd = new Date(start.getTime() + primaryBlock * 60000);
  const companionStart = primaryEnd;
  const companionEnd = new Date(companionStart.getTime() + companionBlock * 60000);

  const dateStr = formatStudioDate(start);
  const timeStr = formatStudioTime(start);

  const slotOk = await availabilityService.hasJointSlotAvailable(
    dateStr,
    timeStr,
    primaryTreatmentId,
    companionClientId,
    primaryClientId
  );
  if (!slotOk) {
    return {
      error: 'Horario no disponible',
      message: 'Este hueco conjunto ya no está libre.',
      status: 409,
    };
  }

  const companionFirstStudio = await isFirstStudioVisit(companionClientId);
  const companionHadTreatment = await hasTreatmentBefore(
    companionClientId,
    companionInfo.companionTreatmentId
  );
  const companionVisitContext = resolveVisitContext({
    isFirstStudio: companionFirstStudio,
    isFirstTreatment: !companionHadTreatment,
  });

  const primaryCancelToken = uuidv4();
  const companionCancelToken = uuidv4();
  const confirmToken = uuidv4();
  const groupId = uuidv4();
  const expiresAt = new Date(Date.now() + JOINT_EXPIRY_HOURS * 60 * 60 * 1000);

  const primaryBookingRes = await dbClient.query(
    `INSERT INTO bookings (
       client_id, treatment_id, start_time, end_time, status, source,
       cancel_token, visit_context, joint_group_id, joint_role
     ) VALUES ($1, $2, $3, $4, 'pending_companion', 'web', $5, $6, $7, 'primary')
     RETURNING id, start_time, end_time, status, cancel_token`,
    [
      primaryClientId,
      realPrimaryTreatmentId,
      start.toISOString(),
      primaryEnd.toISOString(),
      primaryCancelToken,
      visitContext,
      groupId,
    ]
  );
  const primaryBooking = primaryBookingRes.rows[0];

  const companionBookingRes = await dbClient.query(
    `INSERT INTO bookings (
       client_id, treatment_id, start_time, end_time, status, source,
       cancel_token, visit_context, joint_group_id, joint_role
     ) VALUES ($1, $2, $3, $4, 'pending_companion', 'web', $5, $6, $7, 'companion')
     RETURNING id, start_time, end_time, status, cancel_token`,
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
       status, confirm_token, expires_at
     ) VALUES ($1, $2, $3, $4, 'pending_companion', $5, $6)`,
    [
      groupId,
      primaryBooking.id,
      companionBooking.id,
      companionClientId,
      confirmToken,
      expiresAt.toISOString(),
    ]
  );

  return {
    groupId,
    confirmToken,
    expiresAt,
    primaryBooking,
    companionBooking,
    primaryTreatment,
    companionTreatment: companionInfo.treatment,
    primaryStart: start,
    primaryEnd,
    companionStart,
    companionEnd,
  };
}

async function syncGoogleCalendarForBooking(bookingId) {
  const result = await query(
    `SELECT b.*, c.name AS client_name, c.email AS client_email,
            t.name AS treatment_name, t.tag AS treatment_tag
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (result.rows.length === 0) return;
  const row = result.rows[0];

  const {
    buildBookingSummary,
    buildBookingDescription,
    getEventColorId,
  } = require('../utils/webCalendarEvent');

  try {
    const googleCalendar = require('./googleCalendar');
    const event = await googleCalendar.createEvent({
      summary: buildBookingSummary({
        treatmentName: row.treatment_name || 'Cita',
        clientName: row.client_name,
        visitContext: row.visit_context,
      }),
      description: buildBookingDescription({
        treatmentName: row.treatment_name || 'Cita',
        treatmentTag: row.treatment_tag || '',
        clientName: row.client_name,
        clientEmail: row.client_email,
        bookingId: row.id,
        visitContext: row.visit_context,
      }),
      startTime: new Date(row.start_time).toISOString(),
      endTime: new Date(row.end_time).toISOString(),
      clientEmail: row.client_email,
      isWebBooking: true,
      bookingId: row.id,
      colorId: getEventColorId({ visitContext: row.visit_context }),
    });

    if (event?.id) {
      await query(
        `UPDATE bookings SET google_event_id = $1, google_etag = $2, google_updated_at = $3,
         last_sync_source = 'web', updated_at = NOW()
         WHERE id = $4 AND google_event_id IS NULL`,
        [
          event.id,
          event.etag || null,
          event.updated ? new Date(event.updated).toISOString() : null,
          row.id,
        ]
      );
    }
  } catch (err) {
    console.error(`Google sync failed for booking ${bookingId}:`, err.message);
  }
}

function isJointTreatment(treatmentId) {
  return treatmentId === PERFILADO_CONJUNTO_ID;
}

module.exports = {
  BROW_DESIGN_PRIMERA,
  BROW_DESIGN_SEGUIMIENTO,
  PERFILADO_CONJUNTO_ID,
  JOINT_EXPIRY_HOURS,
  OCCUPIED_STATUSES,
  isPerfiladoTreatment,
  isJointTreatment,
  resolveCompanionTreatment,
  resolvePrimaryTreatment,
  lookupCompanionByPhone,
  getJointGroupByToken,
  confirmJointBooking,
  expireJointGroup,
  expirePendingJointGroups,
  cancelJointGroupBookings,
  getJointBookingsForGroup,
  createWebJointBooking,
  syncGoogleCalendarForBooking,
  resolveVisitContext,
  isFirstStudioVisit,
  hasTreatmentBefore,
};
