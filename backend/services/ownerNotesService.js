const { query } = require('../db/pool');

const MAX_BODY = 4000;

const NOTE_SELECT = `
  SELECT n.id, n.client_id, n.booking_id, n.body, n.created_at, n.updated_at,
         t.name AS treatment_name, t.tag AS treatment_tag,
         b.start_time AS booking_start_time, b.status AS booking_status
  FROM studio_notes n
  LEFT JOIN bookings b ON b.id = n.booking_id
  LEFT JOIN treatments t ON t.id = b.treatment_id
`;

function mapNote(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    bookingId: row.booking_id || null,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    treatmentName: row.treatment_name || null,
    treatmentTag: row.treatment_tag || null,
    bookingStartTime: row.booking_start_time || null,
    bookingStatus: row.booking_status || null,
  };
}

function trimBody(body) {
  const text = String(body || '').trim();
  if (!text) return { error: 'Escribe una nota', status: 400 };
  if (text.length > MAX_BODY) {
    return { error: `La nota no puede superar ${MAX_BODY} caracteres`, status: 400 };
  }
  return { text };
}

async function listByClient(clientId) {
  const clientRes = await query('SELECT id, name FROM clients WHERE id = $1', [clientId]);
  if (clientRes.rows.length === 0) return null;

  const notesRes = await query(
    `${NOTE_SELECT}
     WHERE n.client_id = $1
     ORDER BY n.created_at DESC`,
    [clientId]
  );

  const bookingsRes = await query(
    `SELECT b.id, b.start_time, b.end_time, b.status,
            t.name AS treatment_name, t.tag AS treatment_tag
     FROM bookings b
     LEFT JOIN treatments t ON t.id = b.treatment_id
     WHERE b.client_id = $1
     ORDER BY b.start_time DESC
     LIMIT 80`,
    [clientId]
  );

  return {
    client: { id: clientRes.rows[0].id, name: clientRes.rows[0].name },
    notes: notesRes.rows.map(mapNote),
    bookings: bookingsRes.rows.map((b) => ({
      id: b.id,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status,
      treatmentName: b.treatment_name || 'Cita',
      treatmentTag: b.treatment_tag || '',
    })),
  };
}

async function listByBooking(bookingId) {
  const result = await query(
    `${NOTE_SELECT}
     WHERE n.booking_id = $1
     ORDER BY n.created_at DESC`,
    [bookingId]
  );
  return result.rows.map(mapNote);
}

async function createNote(clientId, { body, bookingId }) {
  const parsed = trimBody(body);
  if (parsed.error) return parsed;

  const clientRes = await query('SELECT id FROM clients WHERE id = $1', [clientId]);
  if (clientRes.rows.length === 0) {
    return { error: 'Cliente no encontrado', status: 404 };
  }

  let bookingVal = null;
  if (bookingId != null && bookingId !== '') {
    const bid = Number(bookingId);
    if (!Number.isFinite(bid)) {
      return { error: 'Cita no válida', status: 400 };
    }
    const bookingRes = await query(
      'SELECT id FROM bookings WHERE id = $1 AND client_id = $2',
      [bid, clientId]
    );
    if (bookingRes.rows.length === 0) {
      return { error: 'La cita no pertenece a esta clienta', status: 400 };
    }
    bookingVal = bid;
  }

  const inserted = await query(
    `INSERT INTO studio_notes (client_id, booking_id, body)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [clientId, bookingVal, parsed.text]
  );
  const full = await query(`${NOTE_SELECT} WHERE n.id = $1`, [inserted.rows[0].id]);
  return { note: mapNote(full.rows[0]) };
}

async function updateNote(noteId, { body }) {
  const parsed = trimBody(body);
  if (parsed.error) return parsed;

  const updated = await query(
    `UPDATE studio_notes
     SET body = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [parsed.text, noteId]
  );
  if (updated.rows.length === 0) {
    return { error: 'Nota no encontrada', status: 404 };
  }
  const full = await query(`${NOTE_SELECT} WHERE n.id = $1`, [noteId]);
  return { note: mapNote(full.rows[0]) };
}

async function deleteNote(noteId) {
  const deleted = await query(
    'DELETE FROM studio_notes WHERE id = $1 RETURNING id',
    [noteId]
  );
  if (deleted.rows.length === 0) {
    return { error: 'Nota no encontrada', status: 404 };
  }
  return { ok: true };
}

module.exports = {
  listByClient,
  listByBooking,
  createNote,
  updateNote,
  deleteNote,
};
