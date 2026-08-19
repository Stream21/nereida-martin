const { Router } = require('express');
const requireClientAuth = require('../middleware/requireClientAuth');
const { lookupClientByEmail } = require('../services/clientService');
const { lookupCompanionByPhone, resolvePrimaryTreatment } = require('../services/jointBookingService');
const { query } = require('../db/pool');

const router = Router();

router.get('/lookup-companion', requireClientAuth, async (req, res) => {
  try {
    const phone = (req.query.phone || '').toString().trim();
    if (!phone) {
      return res.status(400).json({ error: 'phone es obligatorio' });
    }

    const result = await lookupCompanionByPhone(phone, req.clientAuth.clientId);
    if (result.error) {
      return res.status(result.status || 400).json({
        error: result.error,
        code: result.code,
      });
    }

    const primaryInfo = await resolvePrimaryTreatment(req.clientAuth.clientId);

    res.json({
      ...result,
      primaryTreatmentId: primaryInfo.error ? null : primaryInfo.companionTreatmentId,
      primaryTreatmentName: primaryInfo.error ? null : primaryInfo.companionTreatmentName,
      primaryPrice: primaryInfo.error ? null : primaryInfo.price,
    });
  } catch (err) {
    console.error('Companion lookup error:', err);
    res.status(500).json({ error: 'Error al buscar acompañante' });
  }
});

router.get('/lookup', requireClientAuth, async (req, res) => {
  try {
    const authRes = await query(
      `SELECT email, account_status FROM clients WHERE id = $1`,
      [req.clientAuth.clientId]
    );
    const authClient = authRes.rows[0];
    if (!authClient || authClient.account_status !== 'active') {
      return res.status(403).json({ error: 'Cuenta no autorizada', code: 'ACCOUNT_INACTIVE' });
    }

    const email = (req.query.email || authClient.email || '').toString().trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'email es obligatorio' });
    }

    if (authClient.email && email !== String(authClient.email).toLowerCase()) {
      return res.status(403).json({ error: 'Solo puedes consultar tu propia cuenta', code: 'FORBIDDEN' });
    }

    const data = await lookupClientByEmail(email);
    if (!data) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    res.json(data);
  } catch (err) {
    console.error('Client lookup error:', err);
    res.status(500).json({ error: 'Error al buscar cliente' });
  }
});

module.exports = router;
