const path = require('path');
const { Router } = require('express');
const { query, getClient } = require('../db/pool');
const { consumeOwnerActionToken } = require('../utils/ownerTokens');
const {
  buildBookingSummary,
  buildBookingDescription,
  getEventColorId,
  formatIntakeSummary,
} = require('../utils/webCalendarEvent');
const { formatDeadlineSpanish } = require('../utils/cancellationPolicy');

const router = Router();

function renderPage(title, message, success = true) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>body{font-family:system-ui,sans-serif;background:#FAF7F2;color:#433D3C;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  .card{background:#fff;border-radius:24px;padding:32px;max-width:420px;text-align:center;box-shadow:0 8px 32px rgba(67,61,60,.08)}
  h1{font-size:1.25rem;margin:0 0 12px}p{color:#6b6564;line-height:1.6}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

async function handleHennaApprove(token) {
  const actionRow = await consumeOwnerActionToken(token, 'henna_approve');
  if (!actionRow) return { status: 404, html: renderPage('Enlace no válido', 'Este enlace ha expirado o ya fue utilizado.', false) };

  const assessmentId = actionRow.entity_id;
  const db = await getClient();

  try {
    await db.query('BEGIN');

    const assessResult = await db.query(
      `SELECT ha.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
              b.id AS booking_id, b.start_time, b.end_time, b.google_event_id, b.intake_id,
              b.visit_context, t.name AS treatment_name, t.tag AS treatment_tag
       FROM henna_assessments ha
       JOIN clients c ON c.id = ha.client_id
       LEFT JOIN bookings b ON b.id = ha.booking_id
       LEFT JOIN treatments t ON t.id = b.treatment_id
       WHERE ha.id = $1`,
      [assessmentId]
    );

    if (assessResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return { status: 404, html: renderPage('No encontrado', 'Valoración no encontrada.', false) };
    }

    const row = assessResult.rows[0];
    if (row.status === 'approved') {
      await db.query('ROLLBACK');
      return { status: 200, html: renderPage('Ya aprobada', 'Esta valoración ya estaba aprobada.') };
    }

    await db.query(
      `UPDATE henna_assessments SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
      [assessmentId]
    );

    if (row.booking_id) {
      await db.query(
        `UPDATE bookings SET status = 'confirmed', review_type = NULL, updated_at = NOW() WHERE id = $1`,
        [row.booking_id]
      );

      let intakeSummary = null;
      let flagged = false;
      let flagReason = null;
      if (row.intake_id) {
        const intakeRes = await db.query('SELECT answers, flagged, flag_reason FROM booking_intakes WHERE id = $1', [row.intake_id]);
        if (intakeRes.rows[0]) {
          intakeSummary = formatIntakeSummary(intakeRes.rows[0].answers);
          flagged = intakeRes.rows[0].flagged;
          flagReason = intakeRes.rows[0].flag_reason;
        }
      }

      if (row.google_event_id) {
        try {
          const googleCalendar = require('../services/googleCalendar');
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
            bookingId: row.booking_id,
            visitContext: row.visit_context,
            intakeSummary,
            flagged,
            flagReason,
          });
          const colorId = getEventColorId({ visitContext: row.visit_context, flagged });

          await googleCalendar.updateEvent(row.google_event_id, {
            summary,
            description,
            startTime: new Date(row.start_time).toISOString(),
            endTime: new Date(row.end_time).toISOString(),
            clientEmail: row.client_email,
            isWebBooking: true,
            bookingId: row.booking_id,
            colorId,
          });
        } catch (err) {
          console.error('Google update on henna approve failed:', err.message);
        }
      }

      try {
        const emailService = require('../services/emailService');
        const frontendUrl = process.env.FRONTEND_URL || '';
        await emailService.sendClientHennaApproved({
          to: row.client_email,
          clientName: row.client_name,
          treatment: { name: row.treatment_name, tag: row.treatment_tag },
          startTime: new Date(row.start_time),
          endTime: new Date(row.end_time),
          cancelUrl: row.booking_id ? `${frontendUrl}/cancelar/${(await db.query('SELECT cancel_token FROM bookings WHERE id = $1', [row.booking_id])).rows[0]?.cancel_token}` : null,
        });
        await emailService.sendConfirmation({
          to: row.client_email,
          clientName: row.client_name,
          treatment: { name: row.treatment_name, tag: row.treatment_tag },
          startTime: new Date(row.start_time),
          endTime: new Date(row.end_time),
          bookingId: row.booking_id,
          cancelUrl: `${frontendUrl}/cancelar/${(await db.query('SELECT cancel_token FROM bookings WHERE id = $1', [row.booking_id])).rows[0]?.cancel_token}`,
          cancellationDeadline: formatDeadlineSpanish(new Date(row.start_time)),
        });
      } catch (err) {
        console.error('Henna approved emails failed:', err.message);
      }
    }

    await db.query('COMMIT');
    return { status: 200, html: renderPage('Valoración aprobada', 'La cita ha sido confirmada y el cliente recibirá un email.') };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function handleHennaReject(token) {
  const actionRow = await consumeOwnerActionToken(token, 'henna_reject');
  if (!actionRow) return { status: 404, html: renderPage('Enlace no válido', 'Este enlace ha expirado o ya fue utilizado.', false) };

  const assessmentId = actionRow.entity_id;
  const db = await getClient();

  try {
    await db.query('BEGIN');

    const assessResult = await db.query(
      `SELECT ha.*, c.name AS client_name, c.email AS client_email,
              b.id AS booking_id, b.start_time, b.end_time, b.google_event_id,
              t.name AS treatment_name, t.tag AS treatment_tag
       FROM henna_assessments ha
       JOIN clients c ON c.id = ha.client_id
       LEFT JOIN bookings b ON b.id = ha.booking_id
       LEFT JOIN treatments t ON t.id = b.treatment_id
       WHERE ha.id = $1`,
      [assessmentId]
    );

    if (assessResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return { status: 404, html: renderPage('No encontrado', 'Valoración no encontrada.', false) };
    }

    const row = assessResult.rows[0];

    await db.query(
      `UPDATE henna_assessments SET status = 'rejected', reviewed_at = NOW() WHERE id = $1`,
      [assessmentId]
    );

    if (row.booking_id) {
      await db.query(
        `UPDATE bookings SET status = 'cancelled', last_sync_source = 'web', updated_at = NOW() WHERE id = $1`,
        [row.booking_id]
      );

      if (row.google_event_id) {
        try {
          const googleCalendar = require('../services/googleCalendar');
          await googleCalendar.deleteEvent(row.google_event_id);
        } catch (err) {
          console.error('Google delete on henna reject failed:', err.message);
        }
      }

      try {
        const emailService = require('../services/emailService');
        await emailService.sendClientHennaRejected({
          to: row.client_email,
          clientName: row.client_name,
          treatment: { name: row.treatment_name || 'Brow Henna', tag: row.treatment_tag || '' },
          startTime: row.start_time ? new Date(row.start_time) : null,
        });
      } catch (err) {
        console.error('Henna reject email failed:', err.message);
      }
    }

    await db.query('COMMIT');
    return {
      status: 200,
      html: renderPage('Valoración rechazada', 'La cita ha sido cancelada y el cliente ha sido notificado.'),
    };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

router.get('/henna/:token/approve', async (req, res) => {
  try {
    const result = await handleHennaApprove(req.params.token);
    res.status(result.status).send(result.html);
  } catch (err) {
    console.error('Henna approve error:', err);
    res.status(500).send(renderPage('Error', 'No se pudo procesar la aprobación.', false));
  }
});

router.get('/henna/:token/reject', async (req, res) => {
  try {
    const result = await handleHennaReject(req.params.token);
    res.status(result.status).send(result.html);
  } catch (err) {
    console.error('Henna reject error:', err);
    res.status(500).send(renderPage('Error', 'No se pudo procesar el rechazo.', false));
  }
});

module.exports = router;
