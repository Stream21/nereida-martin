const { Router } = require('express');
const studioSettings = require('../services/studioSettings');

const router = Router();

router.get('/public', async (_req, res) => {
  try {
    const [bookingStartDate, bookingEndDate] = await Promise.all([
      studioSettings.getBookingStartDate(),
      studioSettings.getBookingEndDate(),
    ]);
    res.json({ bookingStartDate, bookingEndDate });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

module.exports = router;
