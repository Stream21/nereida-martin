const { Router } = require('express');
const { lookupClientByEmail } = require('../services/clientService');

const router = Router();

router.get('/lookup', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email es obligatorio' });
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
