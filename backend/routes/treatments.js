const { Router } = require('express');
const { query } = require('../db/pool');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, category, name, tag, duration_min, duration_max, price,
              COALESCE(display_order, 100) AS display_order
       FROM treatments
       WHERE active = true AND COALESCE(owner_only, false) = false
       ORDER BY display_order ASC, name ASC`
    );

    const treatments = result.rows.map((t) => ({
      ...t,
      displayOrder: Number(t.display_order),
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
