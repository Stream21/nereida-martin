const { Router } = require('express');
const { query } = require('../db/pool');
const { consumeOwnerActionToken } = require('../utils/ownerTokens');
const {
  confirmPendingReview,
  rejectPendingReview,
  resolveBookingIdFromAssessment,
} = require('../services/reviewBookingService');

const router = Router();

function renderPage(title, message) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>body{font-family:system-ui,sans-serif;background:#FAF7F2;color:#433D3C;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  .card{background:#fff;border-radius:24px;padding:32px;max-width:420px;text-align:center;box-shadow:0 8px 32px rgba(67,61,60,.08)}
  h1{font-size:1.25rem;margin:0 0 12px}p{color:#6b6564;line-height:1.6}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

async function handleHennaApprove(token) {
  const actionRow = await consumeOwnerActionToken(token, 'henna_approve');
  if (!actionRow) {
    return {
      status: 404,
      html: renderPage(
        'Enlace no válido',
        'Este enlace ha expirado o ya fue utilizado. Confirma la cita desde la agenda del estudio.'
      ),
    };
  }

  const bookingId = await resolveBookingIdFromAssessment(actionRow.entity_id);
  if (!bookingId) {
    await query(
      `UPDATE henna_assessments SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
      [actionRow.entity_id]
    );
    return {
      status: 200,
      html: renderPage(
        'Valoración marcada',
        'No había una cita asociada. Revisa la agenda del estudio para confirmar o descartar la solicitud.'
      ),
    };
  }

  const result = await confirmPendingReview(bookingId);
  if (result.error) {
    return { status: result.status || 400, html: renderPage('No se pudo confirmar', result.error) };
  }
  return {
    status: 200,
    html: renderPage(
      result.alreadyConfirmed ? 'Ya estaba confirmada' : 'Cita confirmada',
      'La clienta recibirá el email. A partir de ahora confirma o descarta estas solicitudes desde la cita en la agenda.'
    ),
  };
}

async function handleHennaReject(token) {
  const actionRow = await consumeOwnerActionToken(token, 'henna_reject');
  if (!actionRow) {
    return {
      status: 404,
      html: renderPage(
        'Enlace no válido',
        'Este enlace ha expirado o ya fue utilizado. Gestiona la cita desde la agenda del estudio.'
      ),
    };
  }

  const bookingId = await resolveBookingIdFromAssessment(actionRow.entity_id);
  if (!bookingId) {
    await query(
      `UPDATE henna_assessments SET status = 'rejected', reviewed_at = NOW() WHERE id = $1`,
      [actionRow.entity_id]
    );
    return {
      status: 200,
      html: renderPage('Valoración marcada', 'No había una cita asociada. Revisa la agenda del estudio.'),
    };
  }

  const result = await rejectPendingReview(bookingId);
  if (result.error) {
    return { status: result.status || 400, html: renderPage('No se pudo cancelar', result.error) };
  }
  return {
    status: 200,
    html: renderPage(
      result.alreadyCancelled ? 'Ya estaba cancelada' : 'Cita cancelada',
      'La clienta ha sido notificada. A partir de ahora gestiona estas solicitudes desde la cita en la agenda.'
    ),
  };
}

router.get('/henna/:token/approve', async (req, res) => {
  try {
    const result = await handleHennaApprove(req.params.token);
    res.status(result.status).send(result.html);
  } catch (err) {
    console.error('Henna approve error:', err);
    res.status(500).send(renderPage('Error', 'No se pudo procesar la aprobación.'));
  }
});

router.get('/henna/:token/reject', async (req, res) => {
  try {
    const result = await handleHennaReject(req.params.token);
    res.status(result.status).send(result.html);
  } catch (err) {
    console.error('Henna reject error:', err);
    res.status(500).send(renderPage('Error', 'No se pudo procesar el rechazo.'));
  }
});

module.exports = router;
