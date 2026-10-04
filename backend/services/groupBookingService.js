const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const { SLOT_MINUTES, blockDurationMinutes } = require('../utils/slotGrid');
const { formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');
const {
  resolveVisitContext,
  isFirstStudioVisit,
  hasTreatmentBefore,
} = require('./clientService');
const {
  resolveCompanionTreatment,
  getJointPersonBlockMinutes,
  syncGoogleCalendarForBooking,
} = require('./jointBookingService');
const availabilityService = require('./availabilityService');

const PERFILADO_GRUPO_ID = 'perfilado-grupo';
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 6;
const DEFAULT_PERSON_BLOCK = 30;

function snapPersonBlockMinutes(value, fallback = DEFAULT_PERSON_BLOCK) {
  const raw = Number(value);
  const base = Number.isFinite(raw) && raw > 0 ? raw : fallback;
  return Math.max(SLOT_MINUTES, Math.min(45, Math.ceil(base / SLOT_MINUTES) * SLOT_MINUTES));
}

function isGroupTreatment(treatmentId) {
  return treatmentId === PERFILADO_GRUPO_ID;
}

function normalizeClientIds(clientIds) {
  if (!Array.isArray(clientIds)) return [];
  const ids = clientIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  return [...new Set(ids)];
}

function validateGroupClientIds(clientIds) {
  const ids = normalizeClientIds(clientIds);
  if (ids.length < MIN_PARTICIPANTS) {
    return {
      error: `Se necesitan al menos ${MIN_PARTICIPANTS} clientas`,
      status: 400,
      code: 'GROUP_TOO_SMALL',
    };
  }
  if (ids.length > MAX_PARTICIPANTS) {
    return {
      error: `Máximo ${MAX_PARTICIPANTS} clientas por grupo`,
      status: 400,
      code: 'GROUP_TOO_LARGE',
    };
  }
  return { clientIds: ids };
}

async function getDefaultPersonBlockMinutes() {
  try {
    return await getJointPersonBlockMinutes();
  } catch {
    return DEFAULT_PERSON_BLOCK;
  }
}

async function resolveParticipants(clientIds) {
  const participants = [];
  for (const clientId of clientIds) {
    const info = await resolveCompanionTreatment(clientId);
    if (info.error) return info;
    participants.push({
      clientId,
      treatmentId: info.companionTreatmentId,
      treatmentName: info.companionTreatmentName,
      treatmentTag: info.companionTreatmentTag,
      price: info.price,
      treatment: info.treatment,
    });
  }
  return { participants };
}

function hasRealClientEmail(email) {
  return Boolean(email) && email !== 'imported@studio.local';
}

async function getGroupBookingsForGroup(groupId) {
  const result = await query(
    `SELECT b.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
            t.name AS treatment_name, t.tag AS treatment_tag, t.price,
            m.position, m.resolved_treatment_id
     FROM booking_group_members m
     JOIN bookings b ON b.id = m.booking_id
     JOIN clients c ON c.id = m.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE m.group_id = $1
     ORDER BY m.position ASC`,
    [groupId]
  );
  return result.rows;
}

async function cancelGroupBookings(groupId, { notify = true, cancelledBy = 'studio' } = {}) {
  const groupRes = await query(
    `SELECT g.*, array_agg(b.google_event_id) FILTER (WHERE b.google_event_id IS NOT NULL) AS google_ids
     FROM booking_groups g
     LEFT JOIN bookings b ON b.group_booking_id = g.id
     WHERE g.id = $1
     GROUP BY g.id`,
    [groupId]
  );
  if (groupRes.rows.length === 0) {
    return { error: 'Grupo no encontrado', status: 404 };
  }
  const group = groupRes.rows[0];

  const legs = await getGroupBookingsForGroup(groupId);

  await query(
    `UPDATE bookings
     SET status = 'cancelled', last_sync_source = 'owner', updated_at = NOW()
     WHERE group_booking_id = $1 AND status IN ('confirmed', 'pending_review', 'pending_companion')`,
    [groupId]
  );

  await query(`UPDATE booking_groups SET status = 'cancelled' WHERE id = $1`, [groupId]);

  const googleCalendar = require('./googleCalendar');
  for (const leg of legs) {
    if (!leg.google_event_id) continue;
    try {
      await googleCalendar.deleteEvent(leg.google_event_id);
    } catch (err) {
      console.warn('Group cancel Google delete failed:', err.message);
    }
  }

  if (notify) {
    const emailService = require('./emailService');
    for (const leg of legs) {
      if (!hasRealClientEmail(leg.client_email)) continue;
      try {
        await emailService.sendCancellationConfirmation({
          to: leg.client_email,
          clientName: leg.client_name,
          treatment: {
            name: leg.treatment_name || 'Perfilado',
            tag: leg.treatment_tag || '',
          },
          startTime: new Date(leg.start_time),
          endTime: new Date(leg.end_time),
          cancelledBy,
        });
      } catch (err) {
        console.warn('Group cancel email failed:', err.message);
      }
    }
  }

  return group;
}

async function createOwnerGroupBooking({
  clientIds,
  startTime,
  date,
  time,
  durationMinutes,
  treatmentId = PERFILADO_GRUPO_ID,
}) {
  if (!isGroupTreatment(treatmentId)) {
    return { error: 'Tratamiento de grupo no válido', status: 400 };
  }

  const validated = validateGroupClientIds(clientIds);
  if (validated.error) return validated;
  const ids = validated.clientIds;

  let start;
  if (date && time) {
    const [hour, minute] = String(time).split(':').map(Number);
    const { studioLocalToDate } = require('../utils/studioTimezone');
    start = studioLocalToDate(date, hour, minute || 0);
  } else {
    start = new Date(startTime);
  }
  if (isNaN(start.getTime())) {
    return { error: 'Fecha u hora no válida', status: 400 };
  }

  const personBlock = snapPersonBlockMinutes(
    durationMinutes,
    await getDefaultPersonBlockMinutes()
  );

  const participantsRes = await resolveParticipants(ids);
  if (participantsRes.error) return participantsRes;
  const participants = participantsRes.participants;

  const dateStr = formatStudioDate(start);
  const timeStr = formatStudioTime(start);
  const slotOk = await availabilityService.hasGroupSlotAvailable(
    dateStr,
    timeStr,
    ids,
    personBlock,
    { skipPerfiladoLimit: true, skipLeadTime: true }
  );
  if (!slotOk) {
    return {
      error: 'Horario no disponible',
      message: 'Este hueco ya no está libre para el grupo.',
      status: 409,
    };
  }

  const dbClient = await getClient();
  const groupId = uuidv4();

  try {
    await dbClient.query('BEGIN');

    for (const clientId of ids) {
      const clientRes = await dbClient.query(
        `SELECT id FROM clients WHERE id = $1 FOR UPDATE`,
        [clientId]
      );
      if (clientRes.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return { error: 'Clienta no encontrada', status: 404 };
      }
    }

    await dbClient.query(
      `INSERT INTO booking_groups (
         id, treatment_id, participant_count, person_block_minutes, status, source
       ) VALUES ($1, $2, $3, $4, 'confirmed', 'owner')`,
      [groupId, treatmentId, ids.length, personBlock]
    );

    const createdBookings = [];
    let cursor = new Date(start);

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const clientRes = await dbClient.query(
        `SELECT id, name, email, phone FROM clients WHERE id = $1`,
        [participant.clientId]
      );
      const clientRow = clientRes.rows[0];
      const legStart = new Date(cursor);
      const legEnd = new Date(legStart.getTime() + personBlock * 60000);

      const firstStudio = await isFirstStudioVisit(participant.clientId);
      const hadTreatment = await hasTreatmentBefore(participant.clientId, participant.treatmentId);
      const visitContext = resolveVisitContext({
        isFirstStudio: firstStudio,
        isFirstTreatment: !hadTreatment,
      });

      const bookingRes = await dbClient.query(
        `INSERT INTO bookings (
           client_id, treatment_id, start_time, end_time, status, source,
           cancel_token, visit_context, group_booking_id
         ) VALUES ($1, $2, $3, $4, 'confirmed', 'owner', $5, $6, $7)
         RETURNING id, start_time, end_time, cancel_token`,
        [
          participant.clientId,
          participant.treatmentId,
          legStart.toISOString(),
          legEnd.toISOString(),
          uuidv4(),
          visitContext,
          groupId,
        ]
      );
      const booking = bookingRes.rows[0];

      await dbClient.query(
        `INSERT INTO booking_group_members (
           group_id, booking_id, client_id, position, resolved_treatment_id
         ) VALUES ($1, $2, $3, $4, $5)`,
        [groupId, booking.id, participant.clientId, i + 1, participant.treatmentId]
      );

      await dbClient.query(
        `UPDATE clients SET
           first_booking_at = COALESCE(first_booking_at, NOW()),
           last_booking_at = NOW()
         WHERE id = $1`,
        [participant.clientId]
      );

      createdBookings.push({
        ...booking,
        clientId: participant.clientId,
        clientName: clientRow.name,
        clientEmail: clientRow.email,
        treatmentId: participant.treatmentId,
        treatmentName: participant.treatmentName,
        treatmentTag: participant.treatmentTag,
        price: participant.price,
        position: i + 1,
      });

      cursor = legEnd;
    }

    await dbClient.query('COMMIT');

    const emailService = require('./emailService');
    const frontendUrl = process.env.FRONTEND_URL || '';
    const { formatDeadlineSpanish } = require('../utils/cancellationPolicy');

    for (const leg of createdBookings) {
      try {
        await syncGoogleCalendarForBooking(leg.id);
      } catch (err) {
        console.warn('Group booking Google sync failed:', err.message);
      }

      if (!hasRealClientEmail(leg.clientEmail)) continue;
      try {
        await emailService.sendConfirmation({
          to: leg.clientEmail,
          clientName: leg.clientName,
          treatment: { name: leg.treatmentName, tag: leg.treatmentTag || '' },
          startTime: new Date(leg.start_time),
          endTime: new Date(leg.end_time),
          bookingId: leg.id,
          cancelUrl: `${frontendUrl}/cancelar/${leg.cancel_token}`,
          cancellationDeadline: formatDeadlineSpanish(new Date(leg.start_time)),
        });
        await query('UPDATE bookings SET confirmation_sent = true WHERE id = $1', [leg.id]);
      } catch (err) {
        console.warn('Group booking confirmation email failed:', err.message);
      }
    }

    const dashboard = require('./ownerDashboardService');
    const firstBooking = await dashboard.getBookingDetail(createdBookings[0].id);

    return {
      groupId,
      participantCount: ids.length,
      personBlockMinutes: personBlock,
      booking: firstBooking,
      members: createdBookings.map((leg) => ({
        bookingId: leg.id,
        clientId: leg.clientId,
        clientName: leg.clientName,
        treatmentName: leg.treatmentName,
        treatmentTag: leg.treatmentTag,
        price: leg.price,
        startTime: leg.start_time,
        endTime: leg.end_time,
        position: leg.position,
      })),
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

async function previewGroupParticipants(clientIds) {
  const validated = validateGroupClientIds(clientIds);
  if (validated.error) return validated;

  const participantsRes = await resolveParticipants(validated.clientIds);
  if (participantsRes.error) return participantsRes;

  const clientsRes = await query(
    `SELECT id, name, phone FROM clients WHERE id = ANY($1::int[])`,
    [validated.clientIds]
  );
  const clientById = Object.fromEntries(clientsRes.rows.map((row) => [row.id, row]));

  const participants = validated.clientIds.map((clientId, index) => {
    const resolved = participantsRes.participants.find((p) => p.clientId === clientId);
    const client = clientById[clientId];
    return {
      position: index + 1,
      clientId,
      clientName: client?.name || '',
      clientPhone: client?.phone || '',
      treatmentId: resolved?.treatmentId,
      treatmentName: resolved?.treatmentName || 'Perfilado',
      treatmentTag: resolved?.treatmentTag || '',
      price: resolved?.price != null ? Number(resolved.price) : null,
    };
  });

  const totalPrice = participants.reduce((sum, row) => sum + (row.price || 0), 0);

  return { participants, totalPrice };
}

module.exports = {
  PERFILADO_GRUPO_ID,
  MIN_PARTICIPANTS,
  MAX_PARTICIPANTS,
  DEFAULT_PERSON_BLOCK,
  isGroupTreatment,
  normalizeClientIds,
  validateGroupClientIds,
  getDefaultPersonBlockMinutes,
  snapPersonBlockMinutes,
  resolveParticipants,
  getGroupBookingsForGroup,
  cancelGroupBookings,
  createOwnerGroupBooking,
  previewGroupParticipants,
};
