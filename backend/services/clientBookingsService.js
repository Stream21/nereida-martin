const { query } = require('../db/pool');
const { canCancel } = require('../utils/cancellationPolicy');
const { IMPORTED_CLIENT_EMAIL } = require('./studioSettings');
const IMPORTED_SOURCES_SQL = `'google', 'google_sync', 'google_import'`;

function clientBookingBaseSql() {
  return `
    FROM bookings b
    JOIN treatments t ON t.id = b.treatment_id
    WHERE b.client_id = $1
      AND COALESCE(b.complimentary, false) = false
      AND COALESCE(b.treatment_id, '') IS DISTINCT FROM 'imported'
      AND COALESCE(b.source, 'web') NOT IN (${IMPORTED_SOURCES_SQL})
  `;
}

function mapStatusLabel(status) {
  switch (status) {
    case 'confirmed':
      return 'Confirmada';
    case 'pending_review':
      return 'Pendiente de foto';
    case 'pending_companion':
      return 'Esperando acompañante';
    case 'cancelled':
      return 'Cancelada';
    default:
      return status;
  }
}

function mapBookingRow(row, frontendUrl) {
  const startTime = new Date(row.start_time);
  const endTime = new Date(row.end_time);
  const canCancelBooking = row.status === 'confirmed' && canCancel(startTime);
  const cancelUrl =
    row.cancel_token && canCancelBooking
      ? `${frontendUrl}/cancelar/${row.cancel_token}`
      : null;

  return {
    id: row.id,
    treatmentId: row.treatment_id,
    treatmentName: row.treatment_name,
    treatmentTag: row.treatment_tag || null,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_min,
    status: row.status,
    statusLabel: mapStatusLabel(row.status),
    canCancel: canCancelBooking,
    cancelUrl,
  };
}

async function getClientBookings(clientId, { tab = 'upcoming', page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;
  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '') || '';

  let statusFilter = '';
  if (tab === 'upcoming') {
    statusFilter = `AND b.status IN ('confirmed', 'pending_review', 'pending_companion')
      AND b.end_time >= NOW()`;
  } else if (tab === 'past') {
    statusFilter = `AND b.status = 'confirmed' AND b.end_time < NOW()`;
  } else if (tab === 'cancelled') {
    statusFilter = `AND b.status = 'cancelled'`;
  } else {
    return { error: 'Pestaña no válida', code: 'INVALID_TAB', status: 400 };
  }

  const orderBy =
    tab === 'upcoming'
      ? 'b.start_time ASC'
      : 'b.start_time DESC';

  const base = clientBookingBaseSql();
  const params = [clientId];

  const [listRes, countRes, summaryRes] = await Promise.all([
    query(
      `SELECT b.id, b.treatment_id, b.start_time, b.end_time, b.status, b.cancel_token,
              t.name AS treatment_name, t.tag AS treatment_tag, t.duration_min
       ${base}
       ${statusFilter}
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [clientId, safeLimit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total ${base} ${statusFilter}`,
      [clientId]
    ),
    query(
      `SELECT
         COUNT(*) FILTER (
           WHERE b.status IN ('confirmed', 'pending_review', 'pending_companion')
             AND b.end_time >= NOW()
         )::int AS upcoming_count,
         COUNT(*) FILTER (
           WHERE b.status = 'confirmed' AND b.end_time < NOW()
         )::int AS completed_visits
       ${base}`,
      [clientId]
    ),
  ]);

  const total = countRes.rows[0]?.total || 0;
  const summary = summaryRes.rows[0] || {};

  return {
    summary: {
      upcomingCount: summary.upcoming_count || 0,
      completedVisits: summary.completed_visits || 0,
    },
    bookings: listRes.rows.map((row) => mapBookingRow(row, frontendUrl)),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: offset + listRes.rows.length < total,
    },
  };
}

async function getClientBookingStats(clientId) {
  const base = clientBookingBaseSql();

  const [totalsRes, byTreatmentRes] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS completed_visits
       ${base}
       AND b.status = 'confirmed' AND b.end_time < NOW()`,
      [clientId]
    ),
    query(
      `SELECT
         b.treatment_id,
         t.name AS treatment_name,
         t.tag AS treatment_tag,
         COUNT(*)::int AS count
       ${base}
       AND b.status = 'confirmed' AND b.end_time < NOW()
       GROUP BY b.treatment_id, t.name, t.tag
       ORDER BY count DESC, t.name ASC`,
      [clientId]
    ),
  ]);

  return {
    completedVisits: totalsRes.rows[0]?.completed_visits || 0,
    byTreatment: byTreatmentRes.rows.map((row) => ({
      treatmentId: row.treatment_id,
      name: row.treatment_name,
      tag: row.treatment_tag || null,
      count: row.count,
    })),
  };
}

module.exports = {
  getClientBookings,
  getClientBookingStats,
};
