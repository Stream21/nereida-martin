const { Router } = require('express');
const { query } = require('../db/pool');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, category, name, tag, duration_min, duration_max, price
       FROM treatments
       WHERE active = true
       ORDER BY
         CASE category
           WHEN 'cejas' THEN 1
           WHEN 'pestanas' THEN 2
           WHEN 'rostro' THEN 3
           WHEN 'depilacion' THEN 4
           WHEN 'smile' THEN 5
         END,
         name`
    );

    const treatments = result.rows.map((t) => ({
      ...t,
      duration: formatDuration(t.duration_min, t.duration_max),
    }));

    res.json(treatments);
  } catch (err) {
    console.error('Error fetching treatments:', err);
    res.status(500).json({ error: 'Error al obtener tratamientos' });
  }
});

function formatDuration(min, max) {
  const fmt = (m) => {
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const r = m % 60;
      return r > 0 ? `${h}h ${r} min` : `${h} hora${h > 1 ? 's' : ''}`;
    }
    return `${m} min`;
  };

  if (!max || max === min) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

module.exports = router;
