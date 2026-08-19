const { query, getClient } = require('../db/pool');
const {
  buildBookingSummary,
  buildBookingDescription,
  getEventColorId,
  formatIntakeSummary,
} = require('../utils/webCalendarEvent');
const { formatDeadlineSpanish } = require('../utils/cancellationPolicy');

async function loadReviewBooking(db, bookingId) {
  const result = await db.query(
    `SELECT b.id, b.status, b.start_time, b.end_time, b.google_event_id, b.intake_id,
            b.visit_context, b.cancel_token, b.client_id, b.treatment_id,
            c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
            t.name AS treatment_name, t.tag AS treatment_tag
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE b.id = $1
     FOR UPDATE OF b`,
    [bookingId]
  );
  return result.rows[0] || null;
}

async function loadIntakeContext(db, intakeId) {
  if (!intakeId) {
    return { intakeSummary: null, flagged: false, flagReason: null };
  }
  const intakeRes = await db.query(
    'SELECT answers, flagged, flag_reason FROM booking_intakes WHERE id = $1',
    [intakeId]
  );
  const intake = intakeRes.rows[0];
  if (!intake) return { intakeSummary: null, flagged: false, flagReason: null };
  return {
    intakeSummary: formatIntakeSummary(intake.answers),
    flagged: Boolean(intake.flagged),
    flagReason: intake.flag_reason || null,
  };
}

async function approveLinkedAssessments(db, bookingId, clientId) {
  await db.query(
    `UPDATE henna_assessments
     SET status = 'approved',
         reviewed_at = NOW(),
         booking_id = COALESCE(booking_id, $1)
     WHERE status IS DISTINCT FROM 'approved'
       AND (
         booking_id = $1
         OR (client_id = $2 AND booking_id IS NULL AND status = 'pending')
       )`,
    [bookingId, clientId]
  );
}

async function rejectLinkedAssessments(db, bookingId, clientId) {
  await db.query(
    `UPDATE henna_assessments
     SET status = 'rejected',
         reviewed_at = NOW(),
         booking_id = COALESCE(booking_id, $1)
     WHERE status IS DISTINCT FROM 'rejected'
       AND (
         booking_id = $1
         OR (client_id = $2 AND booking_id IS NULL AND status = 'pending')
       )`,
    [bookingId, clientId]
  );
}

async function updateGoogleAfterConfirm(row, { flagged, flagReason, intakeSummary }) {
  if (!row.google_event_id) return;
  try {
    const googleCalendar = require('./googleCalendar');
    const summary = buildBookingSummary({
      treatmentName: row.treatment_name,
      clientName: row.client_name,
      visitContext: row.visit_context,
    });
    const description = buildBookingDescription({
      treatmentName: row.treatment_name,
      treatmentTag: row.treatment_tag,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      bookingId: row.id,
      visitContext: row.visit_context,
      intakeSummary,
      flagged,
      flagReason,
    });
    await googleCalendar.updateEvent(row.google_event_id, {
      summary,
      description,
      startTime: new Date(row.start_time).toISOString(),
      endTime: new Date(row.end_time).toISOString(),
      clientEmail: row.client_email,
      isWebBooking: true,
      bookingId: row.id,
      colorId: getEventColorId({ visitContext: row.visit_context, flagged }),
    });
  } catch (err) {
    console.error('Google update on review confirm failed:', err.message);
  }
}

async function sendConfirmEmails(row) {
  try {
    const emailService = require('./emailService');
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const cancelUrl = row.cancel_token ? `${frontendUrl}/cancelar/${row.cancel_token}` : null;
    const treatment = { name: row.treatment_name, tag: row.treatment_tag };
    const startTime = new Date(row.start_time);
    const endTime = new Date(row.end_time);

    await emailService.sendClientHennaApproved({
      to: row.client_email,
      clientName: row.client_name,
      treatment,
      startTime,
      endTime,
      cancelUrl,
    });
    await emailService.sendConfirmation({
      to: row.client_email,
      clientName: row.client_name,
      treatment,
      startTime,
      endTime,
      bookingId: row.id,
      cancelUrl,
      cancellationDeadline: formatDeadlineSpanish(startTime),
    });
  } catch (err) {
    console.error('Review confirm emails failed:', err.message);
  }
}

async function sendRejectEmails(row) {
  try {
    const emailService = require('./emailService');
    await emailService.sendClientHennaRejected({
      to: row.client_email,
      clientName: row.client_name,
      treatment: { name: row.treatment_name || 'tratamiento', tag: row.treatment_tag || '' },
      startTime: row.start_time ? new Date(row.start_time) : null,
    });
  } catch (err) {
    console.error('Review reject email failed:', err.message);
  }
}

async function confirmPendingReview(bookingId) {
  const id = Number(bookingId);
  if (!Number.isFinite(id)) {
    return { error: 'ID no válido', status: 400 };
  }

  const db = await getClient();
  let row;
  try {
    await db.query('BEGIN');
    row = await loadReviewBooking(db, id);
    if (!row) {
      await db.query('ROLLBACK');
      return { error: 'Cita no encontrada', status: 404 };
    }
    if (row.status === 'confirmed') {
      await db.query('COMMIT');
      return { ok: true, alreadyConfirmed: true };
    }
    if (row.status !== 'pending_review') {
      await db.query('ROLLBACK');
      return { error: 'Esta cita no está pendiente de revisión', status: 409 };
    }

    await db.query(
      `UPDATE bookings
       SET status = 'confirmed',
           review_type = NULL,
           confirmation_sent = true,
           last_sync_source = 'web',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    await approveLinkedAssessments(db, id, row.client_id);
    const intake = await loadIntakeContext(db, row.intake_id);
    await db.query('COMMIT');

    await updateGoogleAfterConfirm(row, intake);
    await sendConfirmEmails(row);
    return { ok: true };
  } catch (err) {
    try {
      await db.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    db.release();
  }
}

async function rejectPendingReview(bookingId) {
  const id = Number(bookingId);
  if (!Number.isFinite(id)) {
    return { error: 'ID no válido', status: 400 };
  }

  const db = await getClient();
  let row;
  try {
    await db.query('BEGIN');
    row = await loadReviewBooking(db, id);
    if (!row) {
      await db.query('ROLLBACK');
      return { error: 'Cita no encontrada', status: 404 };
    }
    if (row.status === 'cancelled') {
      await db.query('COMMIT');
      return { ok: true, alreadyCancelled: true };
    }
    if (row.status !== 'pending_review') {
      await db.query('ROLLBACK');
      return { error: 'Esta cita no está pendiente de revisión', status: 409 };
    }

    await db.query(
      `UPDATE bookings
       SET status = 'cancelled',
           last_sync_source = 'web',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    await rejectLinkedAssessments(db, id, row.client_id);
    await db.query('COMMIT');

    if (row.google_event_id) {
      try {
        const googleCalendar = require('./googleCalendar');
        await googleCalendar.deleteEvent(row.google_event_id);
      } catch (err) {
        console.error('Google delete on review reject failed:', err.message);
      }
    }
    await sendRejectEmails(row);
    return { ok: true };
  } catch (err) {
    try {
      await db.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    db.release();
  }
}

async function resolveBookingIdFromAssessment(assessmentId) {
  const assess = await query(
    `SELECT ha.booking_id, ha.client_id
     FROM henna_assessments ha
     WHERE ha.id = $1`,
    [assessmentId]
  );
  if (assess.rows.length === 0) return null;
  if (assess.rows[0].booking_id) return assess.rows[0].booking_id;

  const pending = await query(
    `SELECT id FROM bookings
     WHERE client_id = $1 AND status = 'pending_review'
     ORDER BY created_at DESC
     LIMIT 1`,
    [assess.rows[0].client_id]
  );
  return pending.rows[0]?.id || null;
}

module.exports = {
  confirmPendingReview,
  rejectPendingReview,
  resolveBookingIdFromAssessment,
};
