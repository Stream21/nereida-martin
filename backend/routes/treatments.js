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
         CASE id
           WHEN 'brow-design-primera' THEN 1
           WHEN 'brow-design-seguimiento' THEN 2
           WHEN 'brow-define' THEN 3
           WHEN 'brow-lami' THEN 4
           WHEN 'brow-lami-define' THEN 5
           WHEN 'brow-henna' THEN 6
           WHEN 'brow-restored' THEN 7
           WHEN 'micropigmentacion-soft-pixel' THEN 8
           WHEN 'lash-lift-korean' THEN 9
           WHEN 'skin-reset' THEN 10
           WHEN 'skin-boost' THEN 11
           WHEN 'labio-superior' THEN 12
           WHEN 'depilacion-facial' THEN 13
           WHEN 'smile-gem' THEN 14
           ELSE 99
         END,
         name`
    );

    const treatments = result.rows.map((t) => ({
      ...t,
      duration: formatDuration(t.duration_min, t.duration_max),
      priceLabel: formatPrice(t.price, t.tag),
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

function formatPrice(price, tag) {
  if (price == null) return null;
  const value = Number(price);
  const label = Number.isInteger(value) ? `${value}€` : `${value.toFixed(2)}€`;
  // Precios orientativos (p. ej. Smile Gem se valora según diseño)
  return /desde/i.test(tag || '') ? `Desde ${label}` : label;
}

module.exports = router;
