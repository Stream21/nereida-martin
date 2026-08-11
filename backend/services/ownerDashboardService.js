const { query } = require('../db/pool');
const { TIMEZONE } = require('../utils/studioTimezone');

const CONFIRMED_FILTER = `b.status = 'confirmed'`;
const TZ = TIMEZONE.replace(/'/g, "''");

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatMonthLabel(year, month) {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

function studioMonthExpr(column) {
  return `EXTRACT(YEAR FROM (${column}) AT TIME ZONE '${TZ}')::int`;
}

function studioMonthNumExpr(column) {
  return `EXTRACT(MONTH FROM (${column}) AT TIME ZONE '${TZ}')::int`;
}

function buildDateFilters({ year, month, from, to }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (year != null && year !== '' && !Number.isNaN(Number(year))) {
    conditions.push(`${studioMonthExpr('b.start_time')} = $${idx}`);
    params.push(Number(year));
    idx += 1;
  }
  if (month != null && month !== '' && !Number.isNaN(Number(month))) {
    conditions.push(`${studioMonthNumExpr('b.start_time')} = $${idx}`);
    params.push(Number(month));
    idx += 1;
  }
  if (from) {
    conditions.push(`(b.start_time AT TIME ZONE '${TZ}')::date >= $${idx}::date`);
    params.push(from);
    idx += 1;
  }
  if (to) {
    conditions.push(`(b.start_time AT TIME ZONE '${TZ}')::date <= $${idx}::date`);
    params.push(to);
    idx += 1;
  }

  return { conditions, params, nextIdx: idx };
}

/** Extra filters for services list / export (treatment, client, price, source). */
function buildServiceFilters({
  year,
  month,
  from,
  to,
  treatmentId,
  client,
  priceMin,
  priceMax,
  source,
}) {
  const { conditions, params, nextIdx } = buildDateFilters({ year, month, from, to });
  let idx = nextIdx;

  if (treatmentId) {
    conditions.push(`b.treatment_id = $${idx}`);
    params.push(treatmentId);
    idx += 1;
  }

  const clientQ = typeof client === 'string' ? client.trim() : '';
  if (clientQ) {
    conditions.push(
      `(c.name ILIKE $${idx} OR COALESCE(c.email, '') ILIKE $${idx} OR COALESCE(c.phone, '') ILIKE $${idx})`
    );
    params.push(`%${clientQ}%`);
    idx += 1;
  }

  if (priceMin != null && priceMin !== '' && !Number.isNaN(Number(priceMin))) {
    conditions.push(`t.price >= $${idx}`);
    params.push(Number(priceMin));
    idx += 1;
  }
  if (priceMax != null && priceMax !== '' && !Number.isNaN(Number(priceMax))) {
    conditions.push(`t.price <= $${idx}`);
    params.push(Number(priceMax));
    idx += 1;
  }

  if (source === 'google') {
    conditions.push(`b.source = 'google'`);
  } else if (source === 'owner') {
    conditions.push(`b.source = 'owner'`);
  } else if (source === 'web') {
    conditions.push(`(b.source = 'web' OR b.source IS NULL OR b.source = '')`);
  }

  return { conditions, params, nextIdx: idx };
}

function mapServiceSource(source) {
  if (source === 'google') return 'google';
  if (source === 'owner') return 'owner';
  return 'web';
}

async function getOverview() {
  const now = new Date();
  const currentYear = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, year: 'numeric' }).format(now)
  );
  const currentMonth = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, month: 'numeric' }).format(now)
  );

  const [overviewRes, bestMonthRes, cancelledRes] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (
           WHERE ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
         )::int AS month_bookings,
         COALESCE(SUM(t.price) FILTER (
           WHERE ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
             AND t.price IS NOT NULL
         ), 0)::numeric AS month_revenue,
         COUNT(*) FILTER (
           WHERE ${studioMonthExpr('b.start_time')} = $1
         )::int AS year_bookings,
         COALESCE(SUM(t.price) FILTER (
           WHERE ${studioMonthExpr('b.start_time')} = $1
             AND t.price IS NOT NULL
         ), 0)::numeric AS year_revenue,
         COUNT(*) FILTER (WHERE t.price IS NULL)::int AS bookings_without_price,
         COUNT(DISTINCT c.id) FILTER (
           WHERE ${studioMonthExpr('c.created_at')} = $1
             AND ${studioMonthNumExpr('c.created_at')} = $2
         )::int AS new_clients_month
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       LEFT JOIN treatments t ON b.treatment_id = t.id
       WHERE ${CONFIRMED_FILTER}`,
      [currentYear, currentMonth]
    ),
    query(
      `SELECT
         ${studioMonthExpr('start_time')} AS year,
         ${studioMonthNumExpr('start_time')} AS month,
         COUNT(*)::int AS booking_count
       FROM bookings
       WHERE status = 'confirmed'
       GROUP BY 1, 2
       ORDER BY booking_count DESC, year DESC, month DESC
       LIMIT 1`
    ),
    query(
      `SELECT
         COUNT(*)::int AS total_cancelled,
         COUNT(*) FILTER (
           WHERE ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
         )::int AS month_cancelled,
         COUNT(*) FILTER (
           WHERE ${studioMonthExpr('b.start_time')} = $1
         )::int AS year_cancelled
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       WHERE b.status = 'cancelled'
         AND c.email != 'imported@studio.local'`,
      [currentYear, currentMonth]
    ),
  ]);

  const row = overviewRes.rows[0];
  const monthBookings = row.month_bookings || 0;
  const monthRevenue = Number(row.month_revenue) || 0;
  const pricedMonthBookings = await query(
    `SELECT COUNT(*)::int AS count
     FROM bookings b
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE ${CONFIRMED_FILTER}
       AND ${studioMonthExpr('b.start_time')} = $1
       AND ${studioMonthNumExpr('b.start_time')} = $2
       AND t.price IS NOT NULL`,
    [currentYear, currentMonth]
  );
  const pricedCount = pricedMonthBookings.rows[0]?.count || 0;

  const bestRow = bestMonthRes.rows[0];
  const bestMonth = bestRow
    ? {
        year: bestRow.year,
        month: bestRow.month,
        label: formatMonthLabel(bestRow.year, bestRow.month),
        bookingCount: bestRow.booking_count,
      }
    : null;

  const cancelledRow = cancelledRes.rows[0] || {};

  return {
    period: { year: currentYear, month: currentMonth, label: formatMonthLabel(currentYear, currentMonth) },
    monthRevenue,
    yearRevenue: Number(row.year_revenue) || 0,
    monthBookings,
    yearBookings: row.year_bookings || 0,
    averageTicket: pricedCount > 0 ? Math.round((monthRevenue / pricedCount) * 100) / 100 : 0,
    newClientsMonth: row.new_clients_month || 0,
    bookingsWithoutPrice: row.bookings_without_price || 0,
    cancelledBookings: cancelledRow.total_cancelled || 0,
    cancelledBookingsMonth: cancelledRow.month_cancelled || 0,
    cancelledBookingsYear: cancelledRow.year_cancelled || 0,
    bestMonth,
  };
}

async function getMonthlySeries(months = 12) {
  const result = await query(
    `SELECT
       ${studioMonthExpr('b.start_time')} AS year,
       ${studioMonthNumExpr('b.start_time')} AS month,
       COUNT(*)::int AS booking_count,
       COALESCE(SUM(t.price) FILTER (WHERE t.price IS NOT NULL), 0)::numeric AS revenue
     FROM bookings b
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE ${CONFIRMED_FILTER}
     GROUP BY 1, 2
     ORDER BY year DESC, month DESC
     LIMIT $1`,
    [months]
  );

  return result.rows
    .map((row) => ({
      year: row.year,
      month: row.month,
      label: formatMonthLabel(row.year, row.month),
      bookingCount: row.booking_count,
      revenue: Number(row.revenue) || 0,
    }))
    .reverse();
}

async function getTopClients(limit = 5) {
  const result = await query(
    `SELECT
       c.id,
       c.name,
       c.email,
       COUNT(b.id)::int AS booking_count,
       COALESCE(SUM(t.price) FILTER (WHERE t.price IS NOT NULL), 0)::numeric AS total_spent
     FROM clients c
     JOIN bookings b ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE ${CONFIRMED_FILTER}
       AND c.email != 'imported@studio.local'
     GROUP BY c.id, c.name, c.email
     ORDER BY total_spent DESC, booking_count DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    bookingCount: row.booking_count,
    totalSpent: Number(row.total_spent) || 0,
  }));
}

async function getByTreatment() {
  const result = await query(
    `SELECT
       COALESCE(t.id, 'sin-tratamiento') AS treatment_id,
       COALESCE(t.name, 'Sin tratamiento') AS treatment_name,
       COALESCE(t.category, 'general') AS category,
       COUNT(b.id)::int AS booking_count,
       COALESCE(SUM(t.price) FILTER (WHERE t.price IS NOT NULL), 0)::numeric AS revenue
     FROM bookings b
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE ${CONFIRMED_FILTER}
     GROUP BY t.id, t.name, t.category
     ORDER BY booking_count DESC, revenue DESC`
  );

  return result.rows.map((row) => ({
    treatmentId: row.treatment_id,
    treatmentName: row.treatment_name,
    category: row.category,
    bookingCount: row.booking_count,
    revenue: Number(row.revenue) || 0,
  }));
}

async function getBySource() {
  const result = await query(
    `SELECT
       CASE WHEN b.source = 'google' THEN 'google' ELSE 'web' END AS source,
       COUNT(*)::int AS booking_count
     FROM bookings b
     WHERE ${CONFIRMED_FILTER}
     GROUP BY 1
     ORDER BY booking_count DESC`
  );

  return result.rows.map((row) => ({
    source: row.source,
    label:
      row.source === 'google'
        ? 'Google Calendar'
        : row.source === 'owner'
          ? 'Agenda estudio'
          : 'Reserva web',
    bookingCount: row.booking_count,
  }));
}

async function listClients({ search = '', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [];
  let idx = 1;
  let searchClause = '';

  if (search.trim()) {
    searchClause = `WHERE (
      c.name ILIKE $${idx}
      OR c.email ILIKE $${idx}
      OR c.phone ILIKE $${idx}
      OR c.phone_normalized ILIKE $${idx}
    )`;
    params.push(`%${search.trim()}%`);
    idx += 1;
  }

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM clients c ${searchClause}`,
    params
  );

  const listRes = await query(
    `SELECT
       c.id,
       c.name,
       c.email,
       c.phone,
       c.phone_normalized,
       c.account_status,
       c.created_at,
       c.registered_at,
       c.first_booking_at,
       COUNT(b.id) FILTER (
         WHERE b.status IN ('confirmed', 'pending_review')
       )::int AS booking_count,
       COALESCE(
         SUM(t.price) FILTER (
           WHERE b.status IN ('confirmed', 'pending_review') AND t.price IS NOT NULL
         ),
         0
       )::numeric AS total_spent,
       MAX(b.start_time) FILTER (
         WHERE b.status IN ('confirmed', 'pending_review')
       ) AS last_booking_at,
       (
         SELECT i.expires_at
         FROM client_invites i
         WHERE i.client_id = c.id AND i.used_at IS NULL
         ORDER BY i.created_at DESC
         LIMIT 1
       ) AS invite_expires_at,
       EXISTS (
         SELECT 1 FROM client_invites i
         WHERE i.client_id = c.id AND i.used_at IS NULL AND i.expires_at > NOW()
       ) AS has_invite
     FROM clients c
     LEFT JOIN bookings b ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     ${searchClause}
     GROUP BY c.id
     ORDER BY last_booking_at DESC NULLS LAST, c.name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return {
    total: countRes.rows[0].total,
    page,
    limit,
    clients: listRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      phoneNormalized: row.phone_normalized,
      accountStatus: row.account_status,
      createdAt: row.created_at,
      registeredAt: row.registered_at,
      firstBookingAt: row.first_booking_at,
      lastBookingAt: row.last_booking_at,
      bookingCount: row.booking_count,
      totalSpent: Number(row.total_spent) || 0,
      hasInvite: Boolean(row.has_invite),
      inviteExpiresAt: row.invite_expires_at,
    })),
  };
}

async function getClientDetail(clientId) {
  const clientRes = await query(
    `SELECT id, name, email, phone, phone_normalized, notes, account_status,
            created_at, registered_at, first_booking_at, last_booking_at, declared_profile
     FROM clients WHERE id = $1`,
    [clientId]
  );
  if (clientRes.rows.length === 0) return null;

  const row = clientRes.rows[0];
  const historyRes = await query(
    `SELECT b.id, b.start_time, b.end_time, b.status, b.source,
            t.name AS treatment_name, t.tag AS treatment_tag, t.price
     FROM bookings b
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE b.client_id = $1
     ORDER BY b.start_time DESC
     LIMIT 50`,
    [clientId]
  );

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    phoneNormalized: row.phone_normalized,
    notes: row.notes || '',
    accountStatus: row.account_status,
    createdAt: row.created_at,
    registeredAt: row.registered_at,
    firstBookingAt: row.first_booking_at,
    lastBookingAt: row.last_booking_at,
    declaredProfile: row.declared_profile,
    history: historyRes.rows.map((b) => ({
      id: b.id,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status,
      source: b.source,
      treatmentName: b.treatment_name,
      treatmentTag: b.treatment_tag,
      price: b.price != null ? Number(b.price) : null,
    })),
  };
}

async function updateClient(clientId, { name, phone, email, notes }) {
  const { normalizePhone } = require('../utils/phone');
  const existing = await query('SELECT id FROM clients WHERE id = $1', [clientId]);
  if (existing.rows.length === 0) {
    return { error: 'Cliente no encontrado', status: 404 };
  }

  const nameTrim = String(name || '').trim();
  if (nameTrim.length < 2) {
    return { error: 'El nombre es obligatorio', status: 400 };
  }

  const emailTrim = email != null && String(email).trim() ? String(email).trim().toLowerCase() : null;
  if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return { error: 'Email no válido', status: 400 };
  }

  const phoneTrim = phone != null ? String(phone).trim() : '';
  const phoneNorm = phoneTrim ? normalizePhone(phoneTrim) : null;
  if (phoneTrim && !phoneNorm) {
    return { error: 'Teléfono no válido', status: 400 };
  }

  const notesVal = notes != null ? String(notes) : null;

  try {
    const result = await query(
      `UPDATE clients
       SET name = $1,
           email = $2,
           phone = $3,
           phone_normalized = $4,
           notes = $5
       WHERE id = $6
       RETURNING id, name, email, phone, notes, account_status`,
      [nameTrim, emailTrim, phoneTrim || null, phoneNorm, notesVal, clientId]
    );
    const row = result.rows[0];
    return {
      client: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        notes: row.notes || '',
        accountStatus: row.account_status,
      },
    };
  } catch (err) {
    if (err.code === '23505') {
      return { error: 'Email o teléfono ya registrados en otro cliente', status: 409, code: 'DUPLICATE' };
    }
    throw err;
  }
}

async function listCalendarEvents({ from, to }) {
  const result = await query(
    `SELECT b.id, b.start_time, b.end_time, b.status, b.source, b.treatment_id,
            c.id AS client_id, c.name AS client_name, c.phone AS client_phone,
            t.name AS treatment_name, t.tag AS treatment_tag, t.duration_min
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE b.status IN ('confirmed', 'pending_review')
       AND b.start_time < $2
       AND b.end_time > $1
     ORDER BY b.start_time ASC`,
    [from, to]
  );

  return result.rows.map((row) => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    source: row.source,
    treatmentId: row.treatment_id,
    treatmentName: row.treatment_name || 'Cita',
    treatmentTag: row.treatment_tag || '',
    durationMin: row.duration_min,
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
  }));
}

async function listOwnerTreatments() {
  const result = await query(
    `SELECT id, category, name, tag, duration_min, duration_max, price, active
     FROM treatments
     WHERE active = true OR id = 'micropigmentacion-soft-pixel'
     ORDER BY active DESC, category, name`
  );
  return result.rows.map((t) => ({
    id: t.id,
    category: t.category,
    name: t.name,
    tag: t.tag,
    durationMin: t.duration_min,
    durationMax: t.duration_max,
    price: t.price != null ? Number(t.price) : null,
    active: t.active,
  }));
}

async function listServices({
  year,
  month,
  from,
  to,
  treatmentId,
  client,
  priceMin,
  priceMax,
  source,
  page = 1,
  limit = 50,
}) {
  const { conditions, params, nextIdx } = buildServiceFilters({
    year,
    month,
    from,
    to,
    treatmentId,
    client,
    priceMin,
    priceMax,
    source,
  });
  const whereParts = [CONFIRMED_FILTER, ...conditions];
  const whereClause = `WHERE ${whereParts.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     ${whereClause}`,
    params
  );

  const listRes = await query(
    `SELECT
       b.id,
       b.start_time,
       b.end_time,
       b.status,
       b.source,
       c.name AS client_name,
       c.email AS client_email,
       c.phone AS client_phone,
       COALESCE(t.name, 'Sin tratamiento') AS treatment_name,
       COALESCE(t.category, 'general') AS treatment_category,
       t.price
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     ${whereClause}
     ORDER BY b.start_time DESC
     LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
    [...params, limit, offset]
  );

  return {
    total: countRes.rows[0].total,
    page,
    limit,
    services: listRes.rows.map((row) => ({
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      source: mapServiceSource(row.source),
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      treatmentName: row.treatment_name,
      treatmentCategory: row.treatment_category,
      price: row.price != null ? Number(row.price) : null,
    })),
  };
}

async function listServicesForExport({
  year,
  month,
  from,
  to,
  treatmentId,
  client,
  priceMin,
  priceMax,
  source,
}) {
  const { conditions, params } = buildServiceFilters({
    year,
    month,
    from,
    to,
    treatmentId,
    client,
    priceMin,
    priceMax,
    source,
  });
  const whereParts = [CONFIRMED_FILTER, ...conditions];
  const whereClause = `WHERE ${whereParts.join(' AND ')}`;

  const result = await query(
    `SELECT
       b.id,
       b.start_time,
       b.source,
       c.name AS client_name,
       c.email AS client_email,
       c.phone AS client_phone,
       COALESCE(t.name, 'Sin tratamiento') AS treatment_name,
       COALESCE(t.category, 'general') AS treatment_category,
       t.price
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     ${whereClause}
     ORDER BY b.start_time ASC`,
    params
  );

  return result.rows;
}

async function getGoals({ year, month }) {
  const result = await query(
    `SELECT metric_key, period_year, period_month, target_value
     FROM metric_goals
     WHERE period_year = $1
       AND (period_month = $2 OR period_month IS NULL)
     ORDER BY metric_key, period_month NULLS LAST`,
    [year, month]
  );

  return result.rows.map((row) => ({
    metricKey: row.metric_key,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    targetValue: Number(row.target_value),
  }));
}

async function upsertGoal({ metricKey, periodYear, periodMonth, targetValue }) {
  const result = await query(
    `INSERT INTO metric_goals (metric_key, period_year, period_month, target_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (metric_key, period_year, period_month)
     DO UPDATE SET target_value = EXCLUDED.target_value, created_at = NOW()
     RETURNING metric_key, period_year, period_month, target_value`,
    [metricKey, periodYear, periodMonth ?? null, targetValue]
  );

  const row = result.rows[0];
  return {
    metricKey: row.metric_key,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    targetValue: Number(row.target_value),
  };
}

module.exports = {
  getOverview,
  getMonthlySeries,
  getTopClients,
  getByTreatment,
  getBySource,
  listClients,
  getClientDetail,
  updateClient,
  listCalendarEvents,
  listOwnerTreatments,
  listServices,
  listServicesForExport,
  getGoals,
  upsertGoal,
  formatMonthLabel,
};
