const { query, getClient } = require('../db/pool');

const CATEGORIES = new Set(['cejas', 'pestanas', 'rostro', 'depilacion', 'smile', 'general']);

/** IDs that must not be deleted; some fields stay protected. */
const PROTECTED_IDS = new Set([
  'imported',
  'perfilado-conjunto',
  'perfilado-grupo',
  'brow-design-primera',
  'brow-design-seguimiento',
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function mapRow(t) {
  return {
    id: t.id,
    category: t.category,
    name: t.name,
    tag: t.tag,
    durationMin: t.duration_min,
    durationMax: t.duration_max,
    price: t.price != null ? Number(t.price) : null,
    active: Boolean(t.active),
    ownerOnly: Boolean(t.owner_only),
    displayOrder: Number(t.display_order),
    protected: PROTECTED_IDS.has(t.id),
  };
}

async function listCatalog() {
  const result = await query(
    `SELECT id, category, name, tag, duration_min, duration_max, price,
            active, COALESCE(owner_only, false) AS owner_only,
            COALESCE(display_order, 100) AS display_order
     FROM treatments
     ORDER BY display_order ASC, name ASC`
  );
  return result.rows.map(mapRow);
}

function validatePayload(body, { requireId = false } = {}) {
  const errors = [];
  const id = typeof body.id === 'string' ? body.id.trim().toLowerCase() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const tag =
    body.tag == null || body.tag === ''
      ? null
      : String(body.tag).trim().slice(0, 200);
  const durationMin = Number(body.durationMin ?? body.duration_min);
  const durationMaxRaw = body.durationMax ?? body.duration_max;
  const durationMax =
    durationMaxRaw == null || durationMaxRaw === ''
      ? null
      : Number(durationMaxRaw);
  const priceRaw = body.price;
  const price =
    priceRaw == null || priceRaw === '' ? null : Number(priceRaw);
  const active = body.active == null ? true : Boolean(body.active);
  const ownerOnly = Boolean(body.ownerOnly ?? body.owner_only);
  const displayOrderRaw = body.displayOrder ?? body.display_order;
  const displayOrder =
    displayOrderRaw == null || displayOrderRaw === ''
      ? null
      : Number(displayOrderRaw);

  if (requireId) {
    if (!id) errors.push('El identificador es obligatorio');
    else if (!SLUG_RE.test(id) || id.length > 50) {
      errors.push('El identificador debe ser un slug (a-z, 0-9, guiones), máx. 50');
    }
  }

  if (!CATEGORIES.has(category)) {
    errors.push('Categoría no válida');
  }
  if (!name || name.length > 100) {
    errors.push('El nombre es obligatorio (máx. 100)');
  }
  if (!Number.isFinite(durationMin) || durationMin < 5 || durationMin > 480) {
    errors.push('Duración mínima entre 5 y 480 minutos');
  }
  if (durationMax != null) {
    if (!Number.isFinite(durationMax) || durationMax < durationMin || durationMax > 480) {
      errors.push('Duración máxima no válida');
    }
  }
  if (price != null && (!Number.isFinite(price) || price < 0 || price > 99999)) {
    errors.push('Precio no válido');
  }
  if (displayOrder != null && (!Number.isFinite(displayOrder) || displayOrder < 0)) {
    errors.push('Orden no válido');
  }

  if (errors.length) {
    const err = new Error(errors[0]);
    err.status = 400;
    err.details = errors;
    throw err;
  }

  return {
    id,
    category,
    name,
    tag,
    durationMin: Math.round(durationMin),
    durationMax: durationMax == null ? null : Math.round(durationMax),
    price,
    active,
    ownerOnly,
    displayOrder: displayOrder == null ? null : Math.round(displayOrder),
  };
}

async function nextDisplayOrder() {
  const result = await query(
    `SELECT COALESCE(MAX(display_order), 0) + 10 AS next_order FROM treatments`
  );
  return Number(result.rows[0].next_order);
}

async function createTreatment(body) {
  const data = validatePayload(body, { requireId: true });
  const displayOrder = data.displayOrder ?? (await nextDisplayOrder());

  try {
    const result = await query(
      `INSERT INTO treatments
         (id, category, name, tag, duration_min, duration_max, price, active, owner_only, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, category, name, tag, duration_min, duration_max, price,
                 active, owner_only, display_order`,
      [
        data.id,
        data.category,
        data.name,
        data.tag,
        data.durationMin,
        data.durationMax,
        data.price,
        data.active,
        data.ownerOnly,
        displayOrder,
      ]
    );
    return mapRow(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('Ya existe un servicio con ese identificador');
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

async function updateTreatment(id, body) {
  if (!id || typeof id !== 'string') {
    const err = new Error('ID no válido');
    err.status = 400;
    throw err;
  }

  const existing = await query(
    `SELECT id, category, name, tag, duration_min, duration_max, price,
            active, COALESCE(owner_only, false) AS owner_only,
            COALESCE(display_order, 100) AS display_order
     FROM treatments WHERE id = $1`,
    [id]
  );
  if (!existing.rows.length) {
    const err = new Error('Servicio no encontrado');
    err.status = 404;
    throw err;
  }

  const current = existing.rows[0];
  const merged = {
    id: current.id,
    category: body.category != null ? body.category : current.category,
    name: body.name != null ? body.name : current.name,
    tag: body.tag !== undefined ? body.tag : current.tag,
    durationMin: body.durationMin != null || body.duration_min != null
      ? (body.durationMin ?? body.duration_min)
      : current.duration_min,
    durationMax: body.durationMax !== undefined || body.duration_max !== undefined
      ? (body.durationMax ?? body.duration_max)
      : current.duration_max,
    price: body.price !== undefined ? body.price : current.price,
    active: body.active != null ? body.active : current.active,
    ownerOnly: body.ownerOnly != null || body.owner_only != null
      ? (body.ownerOnly ?? body.owner_only)
      : current.owner_only,
    displayOrder: body.displayOrder != null || body.display_order != null
      ? (body.displayOrder ?? body.display_order)
      : current.display_order,
  };

  // Protected specials: keep owner_only / structural role stable where needed
  if (id === 'perfilado-grupo') {
    merged.ownerOnly = true;
  }
  if (id === 'imported') {
    merged.active = false;
  }

  const data = validatePayload(
    { ...merged, id: current.id },
    { requireId: false }
  );
  // validatePayload with requireId false still checks category/name — id not revalidated for slug on update
  data.id = current.id;

  const result = await query(
    `UPDATE treatments SET
       category = $2,
       name = $3,
       tag = $4,
       duration_min = $5,
       duration_max = $6,
       price = $7,
       active = $8,
       owner_only = $9,
       display_order = $10
     WHERE id = $1
     RETURNING id, category, name, tag, duration_min, duration_max, price,
               active, owner_only, display_order`,
    [
      id,
      data.category,
      data.name,
      data.tag,
      data.durationMin,
      data.durationMax,
      data.price,
      data.active,
      data.ownerOnly,
      data.displayOrder ?? current.display_order,
    ]
  );
  return mapRow(result.rows[0]);
}

async function reorderTreatments(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Lista de orden vacía');
    err.status = 400;
    throw err;
  }

  const normalized = items.map((item, index) => {
    const id = typeof item.id === 'string' ? item.id : '';
    const order =
      item.displayOrder != null
        ? Number(item.displayOrder)
        : (index + 1) * 10;
    if (!id || !Number.isFinite(order) || order < 0) {
      const err = new Error('Elemento de orden no válido');
      err.status = 400;
      throw err;
    }
    return { id, displayOrder: Math.round(order) };
  });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const item of normalized) {
      const r = await client.query(
        `UPDATE treatments SET display_order = $2 WHERE id = $1`,
        [item.id, item.displayOrder]
      );
      if (r.rowCount === 0) {
        const err = new Error(`Servicio no encontrado: ${item.id}`);
        err.status = 404;
        throw err;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }

  return listCatalog();
}

module.exports = {
  CATEGORIES: [...CATEGORIES],
  PROTECTED_IDS,
  listCatalog,
  createTreatment,
  updateTreatment,
  reorderTreatments,
};
