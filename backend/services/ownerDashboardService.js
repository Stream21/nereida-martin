const { query } = require('../db/pool');
const { TIMEZONE } = require('../utils/studioTimezone');
const { formatIntakeForOwner } = require('../config/intakeQuestions');
const { IMPORTED_CLIENT_EMAIL } = require('./studioSettings');
const { listGoogleCalendarItemsInRange } = require('./ghostBlockRanges');

const CONFIRMED_FILTER = `b.status = 'confirmed'`;
const CONTRACTED_FILTER = `b.status IN ('confirmed', 'pending_review')`;
const COMPLETED_SQL = `b.start_time <= NOW()`;
const TZ = TIMEZONE.replace(/'/g, "''");
const IMPORTED_EMAIL_SQL = IMPORTED_CLIENT_EMAIL.replace(/'/g, "''");
const IMPORTED_SOURCES_SQL = `'google', 'google_sync', 'google_import'`;

/** Citas reales de la app (web + agenda). Excluye bloques Importado Google. */
function webFedSql(bookingAlias = 'b', clientAlias = 'c') {
  return `(
    ${clientAlias}.email IS DISTINCT FROM '${IMPORTED_EMAIL_SQL}'
    AND COALESCE(${bookingAlias}.source, 'web') NOT IN (${IMPORTED_SOURCES_SQL})
    AND COALESCE(${bookingAlias}.treatment_id, '') IS DISTINCT FROM 'imported'
  )`;
}

function importedSql(bookingAlias = 'b', clientAlias = 'c') {
  return `(
    ${clientAlias}.email = '${IMPORTED_EMAIL_SQL}'
    OR COALESCE(${bookingAlias}.source, '') IN (${IMPORTED_SOURCES_SQL})
    OR ${bookingAlias}.treatment_id = 'imported'
  )`;
}

function notImportedClientSql(clientAlias = 'c') {
  return `${clientAlias}.email IS DISTINCT FROM '${IMPORTED_EMAIL_SQL}'`;
}

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
    conditions.push(`COALESCE(b.source, '') IN (${IMPORTED_SOURCES_SQL})`);
  } else if (source === 'owner') {
    conditions.push(`b.source = 'owner'`);
  } else if (source === 'web') {
    conditions.push(`(b.source = 'web' OR b.source IS NULL OR b.source = '')`);
  }

  conditions.push(notImportedClientSql('c'));

  return { conditions, params, nextIdx: idx };
}

function mapServiceSource(source) {
  if (source === 'google' || source === 'google_sync' || source === 'google_import') {
    return 'google';
  }
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

  const webFed = webFedSql();
  const imported = importedSql();

  const [overviewRes, bestMonthRes, cancelledRes, clientsRes] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND ${CONFIRMED_FILTER}
             AND ${COMPLETED_SQL}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
         )::int AS month_bookings,
         COALESCE(SUM(t.price) FILTER (
           WHERE ${webFed}
             AND ${CONFIRMED_FILTER}
             AND ${COMPLETED_SQL}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
             AND t.price IS NOT NULL
         ), 0)::numeric AS month_revenue,
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND ${CONFIRMED_FILTER}
             AND ${COMPLETED_SQL}
             AND ${studioMonthExpr('b.start_time')} = $1
         )::int AS year_bookings,
         COALESCE(SUM(t.price) FILTER (
           WHERE ${webFed}
             AND ${CONFIRMED_FILTER}
             AND ${COMPLETED_SQL}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND t.price IS NOT NULL
         ), 0)::numeric AS year_revenue,
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND ${CONFIRMED_FILTER}
             AND ${COMPLETED_SQL}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
             AND t.price IS NOT NULL
         )::int AS priced_month_bookings,
         COUNT(*) FILTER (
           WHERE ${webFed}
         )::int AS contracted_bookings,
         COALESCE(SUM(t.price) FILTER (
           WHERE ${webFed}
             AND t.price IS NOT NULL
         ), 0)::numeric AS contracted_revenue,
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND ${studioMonthExpr('b.start_time')} = $1
         )::int AS year_contracted_bookings,
         COALESCE(SUM(t.price) FILTER (
           WHERE ${webFed}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND t.price IS NOT NULL
         ), 0)::numeric AS year_contracted_revenue,
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
         )::int AS month_contracted_bookings,
         COALESCE(SUM(t.price) FILTER (
           WHERE ${webFed}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
             AND t.price IS NOT NULL
         ), 0)::numeric AS month_contracted_revenue,
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND b.status = 'pending_review'
         )::int AS pending_review_bookings,
         COUNT(*) FILTER (WHERE ${webFed} AND ${CONFIRMED_FILTER} AND t.price IS NULL)::int AS bookings_without_price,
         COUNT(*) FILTER (WHERE ${imported})::int AS imported_total,
         COUNT(*) FILTER (
           WHERE ${imported}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
         )::int AS imported_month,
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND ${CONFIRMED_FILTER}
             AND ${COMPLETED_SQL}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
             AND b.visit_context = 'first_studio_visit'
         )::int AS first_visits_month,
         COUNT(*) FILTER (
           WHERE ${webFed}
             AND ${CONFIRMED_FILTER}
             AND ${COMPLETED_SQL}
             AND ${studioMonthExpr('b.start_time')} = $1
             AND ${studioMonthNumExpr('b.start_time')} = $2
             AND b.visit_context = 'returning'
         )::int AS returning_month
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       LEFT JOIN treatments t ON b.treatment_id = t.id
       WHERE ${CONTRACTED_FILTER}`,
      [currentYear, currentMonth]
    ),
    query(
      `SELECT
         ${studioMonthExpr('b.start_time')} AS year,
         ${studioMonthNumExpr('b.start_time')} AS month,
         COUNT(*)::int AS booking_count
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       WHERE ${CONFIRMED_FILTER}
         AND ${webFedSql()}
         AND ${COMPLETED_SQL}
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
         AND ${webFedSql()}`,
      [currentYear, currentMonth]
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE account_status = 'active')::int AS active_clients,
         COUNT(*) FILTER (
           WHERE ${studioMonthExpr('created_at')} = $1
             AND ${studioMonthNumExpr('created_at')} = $2
         )::int AS new_clients_month,
         COUNT(*) FILTER (
           WHERE account_status = 'active'
             AND ${studioMonthExpr('COALESCE(registered_at, created_at)')} = $1
             AND ${studioMonthNumExpr('COALESCE(registered_at, created_at)')} = $2
         )::int AS new_active_month
       FROM clients
       WHERE ${notImportedClientSql('clients')}`,
      [currentYear, currentMonth]
    ),
  ]);

  const row = overviewRes.rows[0];
  const monthBookings = row.month_bookings || 0;
  const monthRevenue = Number(row.month_revenue) || 0;
  const returningMonth = row.returning_month || 0;
  const pricedCount = row.priced_month_bookings || 0;

  const upcomingRes = await query(
    `SELECT COUNT(*)::int AS count
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     WHERE b.status IN ('confirmed', 'pending_review')
       AND ${webFedSql()}
       AND b.start_time >= NOW()
       AND b.start_time < NOW() + INTERVAL '7 days'`
  );

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
  const clientsRow = clientsRes.rows[0] || {};

  return {
    period: { year: currentYear, month: currentMonth, label: formatMonthLabel(currentYear, currentMonth) },
    monthRevenue,
    yearRevenue: Number(row.year_revenue) || 0,
    monthBookings,
    yearBookings: row.year_bookings || 0,
    contractedRevenue: Number(row.contracted_revenue) || 0,
    contractedBookings: row.contracted_bookings || 0,
    yearContractedRevenue: Number(row.year_contracted_revenue) || 0,
    yearContractedBookings: row.year_contracted_bookings || 0,
    monthContractedRevenue: Number(row.month_contracted_revenue) || 0,
    monthContractedBookings: row.month_contracted_bookings || 0,
    pendingReviewBookings: row.pending_review_bookings || 0,
    averageTicket: pricedCount > 0 ? Math.round((monthRevenue / pricedCount) * 100) / 100 : 0,
    newClientsMonth: clientsRow.new_clients_month || 0,
    activeClients: clientsRow.active_clients || 0,
    newActiveMonth: clientsRow.new_active_month || 0,
    bookingsWithoutPrice: row.bookings_without_price || 0,
    cancelledBookings: cancelledRow.total_cancelled || 0,
    cancelledBookingsMonth: cancelledRow.month_cancelled || 0,
    cancelledBookingsYear: cancelledRow.year_cancelled || 0,
    importedBookingsTotal: row.imported_total || 0,
    importedBookingsMonth: row.imported_month || 0,
    upcomingWeekBookings: upcomingRes.rows[0]?.count || 0,
    firstVisitsMonth: row.first_visits_month || 0,
    returningRateMonth:
      monthBookings > 0 ? Math.round((returningMonth / monthBookings) * 100) : 0,
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
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE ${CONFIRMED_FILTER}
       AND ${webFedSql()}
       AND ${COMPLETED_SQL}
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
       AND ${webFedSql()}
       AND ${COMPLETED_SQL}
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
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE ${CONFIRMED_FILTER}
       AND ${webFedSql()}
       AND ${COMPLETED_SQL}
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
       CASE
         WHEN b.visit_context = 'first_studio_visit' THEN 'first_studio_visit'
         WHEN b.visit_context = 'first_treatment' THEN 'first_treatment'
         ELSE 'returning'
       END AS source,
       COUNT(*)::int AS booking_count
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     WHERE ${CONFIRMED_FILTER}
       AND ${webFedSql()}
       AND ${COMPLETED_SQL}
     GROUP BY 1
     ORDER BY booking_count DESC`
  );

  const labels = {
    first_studio_visit: 'Primera visita',
    first_treatment: 'Nuevo tratamiento',
    returning: 'Clienta conocida',
  };

  return result.rows.map((row) => ({
    source: row.source,
    label: labels[row.source] || 'Clienta conocida',
    bookingCount: row.booking_count,
  }));
}

async function listClients({
  search = '',
  page = 1,
  limit = 20,
  status = '',
  treatmentId = '',
  lastFrom = '',
  lastTo = '',
  minBookings = '',
  maxBookings = '',
}) {
  const offset = (page - 1) * limit;
  const params = [];
  let idx = 1;
  const whereParts = [];

  if (search.trim()) {
    whereParts.push(`(
      c.name ILIKE $${idx}
      OR c.email ILIKE $${idx}
      OR c.phone ILIKE $${idx}
      OR c.phone_normalized ILIKE $${idx}
    )`);
    params.push(`%${search.trim()}%`);
    idx += 1;
  }

  whereParts.push(notImportedClientSql('c'));

  const statusKey = typeof status === 'string' ? status.trim() : '';
  if (statusKey === 'disabled' || statusKey === 'active') {
    whereParts.push(`c.account_status = $${idx}`);
    params.push(statusKey);
    idx += 1;
  } else if (statusKey === 'invited') {
    whereParts.push(
      `c.account_status NOT IN ('active', 'disabled')
       AND EXISTS (
         SELECT 1 FROM client_invites i
         WHERE i.client_id = c.id AND i.used_at IS NULL AND i.expires_at > NOW()
       )`
    );
  } else if (statusKey === 'pending') {
    whereParts.push(
      `c.account_status NOT IN ('active', 'disabled')
       AND NOT EXISTS (
         SELECT 1 FROM client_invites i
         WHERE i.client_id = c.id AND i.used_at IS NULL AND i.expires_at > NOW()
       )`
    );
  }

  if (treatmentId) {
    whereParts.push(`EXISTS (
      SELECT 1 FROM bookings bt
      WHERE bt.client_id = c.id
        AND bt.treatment_id = $${idx}
        AND bt.status IN ('confirmed', 'pending_review')
    )`);
    params.push(treatmentId);
    idx += 1;
  }

  const havingParts = [];
  if (lastFrom) {
    havingParts.push(
      `(MAX(b.start_time) FILTER (WHERE b.status IN ('confirmed', 'pending_review')) AT TIME ZONE '${TZ}')::date >= $${idx}::date`
    );
    params.push(lastFrom);
    idx += 1;
  }
  if (lastTo) {
    havingParts.push(
      `(MAX(b.start_time) FILTER (WHERE b.status IN ('confirmed', 'pending_review')) AT TIME ZONE '${TZ}')::date <= $${idx}::date`
    );
    params.push(lastTo);
    idx += 1;
  }
  if (minBookings !== '' && minBookings != null && !Number.isNaN(Number(minBookings))) {
    havingParts.push(
      `COUNT(b.id) FILTER (WHERE b.status IN ('confirmed', 'pending_review')) >= $${idx}`
    );
    params.push(Number(minBookings));
    idx += 1;
  }
  if (maxBookings !== '' && maxBookings != null && !Number.isNaN(Number(maxBookings))) {
    havingParts.push(
      `COUNT(b.id) FILTER (WHERE b.status IN ('confirmed', 'pending_review')) <= $${idx}`
    );
    params.push(Number(maxBookings));
    idx += 1;
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const havingClause = havingParts.length ? `HAVING ${havingParts.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM (
       SELECT c.id
       FROM clients c
       LEFT JOIN bookings b ON b.client_id = c.id
       LEFT JOIN treatments t ON b.treatment_id = t.id
       ${whereClause}
       GROUP BY c.id
       ${havingClause}
     ) filtered`,
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
     ${whereClause}
     GROUP BY c.id
     ${havingClause}
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
    `SELECT b.id, b.start_time, b.end_time, b.status, b.source, b.treatment_id,
            t.name AS treatment_name, t.tag AS treatment_tag, t.price,
            b.intake_id, i.flagged AS intake_flagged,
            EXISTS (
              SELECT 1 FROM henna_assessments ha WHERE ha.booking_id = b.id
            ) AS has_photo
     FROM bookings b
     LEFT JOIN treatments t ON b.treatment_id = t.id
     LEFT JOIN booking_intakes i ON i.id = b.intake_id
     WHERE b.client_id = $1
     ORDER BY b.start_time DESC
     LIMIT 50`,
    [clientId]
  );

  const photos = await listAssessmentPhotos(
    `WHERE client_id = $1 ORDER BY created_at DESC LIMIT 40`,
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
      treatmentId: b.treatment_id,
      treatmentName: b.treatment_name,
      treatmentTag: b.treatment_tag,
      price: b.price != null ? Number(b.price) : null,
      hasIntake: Boolean(b.intake_id),
      intakeFlagged: Boolean(b.intake_flagged),
      hasPhoto: Boolean(b.has_photo),
    })),
    photos,
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
            b.google_event_id, b.joint_group_id, b.joint_role,
            c.id AS client_id, c.name AS client_name, c.phone AS client_phone,
            t.name AS treatment_name, t.tag AS treatment_tag, t.duration_min,
            b.intake_id, i.flagged AS intake_flagged,
            jp.name AS joint_partner_name,
            EXISTS (
              SELECT 1 FROM henna_assessments ha
              WHERE ha.booking_id = b.id
                 OR (
                   ha.client_id = b.client_id
                   AND ha.booking_id IS NULL
                   AND b.treatment_id = 'micropigmentacion-soft-pixel'
                 )
            ) AS has_photo
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     LEFT JOIN booking_intakes i ON i.id = b.intake_id
     LEFT JOIN bookings jb ON jb.joint_group_id = b.joint_group_id AND jb.id <> b.id
     LEFT JOIN clients jp ON jp.id = jb.client_id
     WHERE b.status IN ('confirmed', 'pending_review', 'pending_companion', 'google_overlap')
       AND b.start_time < $2
       AND b.end_time > $1
     ORDER BY b.start_time ASC`,
    [from, to]
  );

  const mapped = result.rows.map((row) => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    source: row.source,
    googleEventId: row.google_event_id,
    treatmentId: row.treatment_id,
    treatmentName: row.treatment_name || 'Cita',
    treatmentTag: row.treatment_tag || '',
    durationMin: row.duration_min,
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    hasIntake: Boolean(row.intake_id),
    intakeFlagged: Boolean(row.intake_flagged),
    hasPhoto: Boolean(row.has_photo),
    jointGroupId: row.joint_group_id,
    jointRole: row.joint_role,
    jointPartnerName: row.joint_partner_name || null,
    isJoint: Boolean(row.joint_group_id),
  }));

  let googleItems = [];
  try {
    googleItems = await listGoogleCalendarItemsInRange(from, to);
  } catch (err) {
    console.warn('Live Google calendar overlay skipped:', err.message);
    return mapped;
  }

  const knownGoogleIds = new Set(
    mapped.map((ev) => ev.googleEventId).filter(Boolean)
  );
  const knownBookingIds = new Set(mapped.map((ev) => String(ev.id)));
  const summaryByGoogleId = new Map(
    googleItems.map((item) => [item.googleEventId, item.summary])
  );

  for (const ev of mapped) {
    if (!ev.googleEventId) continue;
    const summary = summaryByGoogleId.get(ev.googleEventId);
    if (!summary) continue;
    const imported =
      ev.treatmentId === 'imported' ||
      (typeof ev.source === 'string' && ev.source.startsWith('google'));
    if (imported) ev.clientName = summary;
  }

  const live = [];
  for (const item of googleItems) {
    if (knownGoogleIds.has(item.googleEventId)) continue;
    if (item.webBookingId && knownBookingIds.has(String(item.webBookingId))) continue;

    const suffix = item.dateKey ? `:${item.dateKey}` : '';
    live.push({
      id: `gcal:${item.googleEventId}${suffix}`,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.isGhost ? 'google_block' : 'confirmed',
      source: 'google',
      treatmentId: 'imported',
      treatmentName: item.isGhost ? 'Bloqueo' : 'Cita Google',
      treatmentTag: '',
      durationMin: Math.round((item.endTime - item.startTime) / 60000),
      clientId: null,
      clientName: item.summary,
      clientPhone: null,
      hasIntake: false,
      intakeFlagged: false,
      hasPhoto: false,
      jointGroupId: null,
      jointRole: null,
      jointPartnerName: null,
      isJoint: false,
      liveGoogle: true,
    });
  }

  return [...mapped, ...live].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );
}

function toUploadUrl(photoPath) {
  if (!photoPath || String(photoPath).includes('..')) return null;
  const clean = String(photoPath).replace(/\\/g, '/').replace(/^\/+/, '');
  return `/uploads/${clean}`;
}

function mapAssessmentPhoto(row) {
  if (!row?.photo_path) return null;
  const photoUrl = toUploadUrl(row.photo_path);
  if (!photoUrl) return null;
  const inferredSource = String(row.photo_path).replace(/\\/g, '/').startsWith('micro-requests/')
    ? 'micro_request'
    : 'booking';
  return {
    id: row.id,
    photoPath: row.photo_path,
    photoUrl,
    status: row.status,
    source: row.source || inferredSource,
    notes: row.notes || '',
    createdAt: row.created_at,
    bookingId: row.booking_id || null,
  };
}

async function listAssessmentPhotos(whereSql, params) {
  try {
    const result = await query(
      `SELECT id, photo_path, status, source, notes, booking_id, created_at
       FROM henna_assessments
       ${whereSql}`,
      params
    );
    return result.rows.map(mapAssessmentPhoto).filter(Boolean);
  } catch (err) {
    const result = await query(
      `SELECT id, photo_path, status, booking_id, created_at
       FROM henna_assessments
       ${whereSql}`,
      params
    );
    return result.rows.map(mapAssessmentPhoto).filter(Boolean);
  }
}

function mapIntake(row) {
  if (!row.intake_pk) return null;
  return {
    id: row.intake_pk,
    type: row.intake_type,
    flagged: Boolean(row.flagged),
    flagReason: row.flag_reason || '',
    signerName: row.signer_name || '',
    signedAt: row.signed_at,
    signatureData: row.signature_data || null,
    createdAt: row.intake_created_at,
    answers: formatIntakeForOwner(row.answers),
  };
}

async function getBookingDetail(bookingId) {
  const result = await query(
    `SELECT
       b.id, b.start_time, b.end_time, b.status, b.source, b.treatment_id, b.visit_context,
       b.intake_id, b.joint_group_id, b.joint_role,
       c.id AS client_id, c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
       t.name AS treatment_name, t.tag AS treatment_tag, t.price, t.category AS treatment_category,
       i.id AS intake_pk, i.intake_type, i.answers, i.flagged, i.flag_reason,
       i.signer_name, i.signed_at, i.signature_data, i.created_at AS intake_created_at,
       jb.id AS joint_partner_booking_id,
       jc.name AS joint_partner_name,
       jt.name AS joint_partner_treatment_name
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN treatments t ON t.id = b.treatment_id
     LEFT JOIN booking_intakes i ON i.id = b.intake_id
     LEFT JOIN bookings jb ON jb.joint_group_id = b.joint_group_id AND jb.id <> b.id
     LEFT JOIN clients jc ON jc.id = jb.client_id
     LEFT JOIN treatments jt ON jt.id = jb.treatment_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const intake = mapIntake(row);

  const photos = await listAssessmentPhotos(
    `WHERE booking_id = $1
        OR (
          client_id = $2
          AND booking_id IS NULL
          AND $3 = 'micropigmentacion-soft-pixel'
        )
     ORDER BY created_at DESC`,
    [row.id, row.client_id, row.treatment_id]
  );

  return {
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    source: row.source,
    visitContext: row.visit_context,
    treatmentId: row.treatment_id,
    treatmentName: row.treatment_name || 'Cita',
    treatmentTag: row.treatment_tag || '',
    treatmentCategory: row.treatment_category || '',
    price: row.price != null ? Number(row.price) : null,
    clientId: row.client_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    hasIntake: Boolean(intake),
    intakeFlagged: Boolean(intake?.flagged),
    intake,
    hasPhoto: photos.length > 0,
    photos,
    jointGroupId: row.joint_group_id,
    jointRole: row.joint_role,
    isJoint: Boolean(row.joint_group_id),
    jointPartner: row.joint_partner_booking_id
      ? {
          bookingId: row.joint_partner_booking_id,
          name: row.joint_partner_name,
          treatmentName: row.joint_partner_treatment_name,
        }
      : null,
  };
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
  getBookingDetail,
  listOwnerTreatments,
  listServices,
  listServicesForExport,
  getGoals,
  upsertGoal,
  formatMonthLabel,
};
