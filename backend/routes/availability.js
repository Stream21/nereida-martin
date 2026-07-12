const { Router } = require('express');
const availabilityService = require('../services/availabilityService');

const router = Router();

router.get('/next', async (req, res) => {
  try {
    const { treatmentId } = req.query;

    if (!treatmentId) {
      return res.status(400).json({ error: 'treatmentId es obligatorio' });
    }

    const result = await availabilityService.findNextAvailableSlot(treatmentId);

    if (result.error === 'not_found') {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching next slot:', err);
    res.status(500).json({ error: 'Error al obtener el próximo hueco' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { date, treatmentId } = req.query;

    if (!date || !treatmentId) {
      return res.status(400).json({ error: 'date y treatmentId son obligatorios' });
    }

    const parsedDate = new Date(`${date}T12:00:00`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }

    const result = await availabilityService.getAvailabilityForDate(date, treatmentId);

    if (result.error === 'not_found') {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

module.exports = router;
