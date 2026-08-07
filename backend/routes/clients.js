const { Router } = require('express');
const requireClientAuth = require('../middleware/requireClientAuth');
const { lookupClientByEmail } = require('../services/clientService');
const { query } = require('../db/pool');

const router = Router();

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
