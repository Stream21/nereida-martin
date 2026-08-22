const ExcelJS = require('exceljs');
const { query } = require('../db/pool');
const { normalizePhone } = require('../utils/phone');

function pickNamePhone(rowValues) {
  const cells = (rowValues || []).map((v) => (v == null ? '' : String(v).trim()));
  // Header-aware: find name/phone by header text on first data pass — caller strips header
  const name = cells[0] || '';
  const phone = cells[1] || '';
  return { name, phone };
}

function isHeaderRow(name, phone) {
  const n = name.toLowerCase();
  const p = phone.toLowerCase();
  return n.includes('nombre') || p.includes('telefono') || p.includes('teléfono');
}

/**
 * @param {Array<{name: string, phone?: string, email?: string}>} rows
 * @param {{ dryRun?: boolean }} options
 */
async function upsertClientRows(rows, { dryRun = false } = {}) {
  const summary = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    const name = String(row.name || '').trim();
    if (!name || name.length < 2) {
      summary.skipped += 1;
      continue;
    }

    const phoneRaw = row.phone ? String(row.phone).trim() : '';
    const phoneNorm = normalizePhone(phoneRaw);
    const email = row.email ? String(row.email).trim().toLowerCase() : null;
    const emailValid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;

    try {
      if (phoneNorm) {
        const existing = await query(
          `SELECT id, name, phone, email FROM clients WHERE phone_normalized = $1`,
          [phoneNorm]
        );
        if (existing.rows.length) {
          if (!dryRun) {
            await query(
              `UPDATE clients
               SET name = $1,
                   phone = COALESCE(NULLIF($2, ''), phone),
                   email = COALESCE(email, $3)
               WHERE id = $4`,
              [name, phoneRaw, emailValid, existing.rows[0].id]
            );
          }
          summary.updated += 1;
          continue;
        }
      }

      if (emailValid) {
        const existingEmail = await query(
          `SELECT id FROM clients WHERE LOWER(email) = $1`,
          [emailValid]
        );
        if (existingEmail.rows.length) {
          if (!dryRun) {
            await query(
              `UPDATE clients
               SET name = $1,
                   phone = COALESCE(NULLIF($2, ''), phone),
                   phone_normalized = COALESCE($3, phone_normalized)
               WHERE id = $4`,
              [name, phoneRaw, phoneNorm, existingEmail.rows[0].id]
            );
          }
          summary.updated += 1;
          continue;
        }
      }

      if (!dryRun) {
        await query(
          `INSERT INTO clients (name, email, phone, phone_normalized, account_status)
           VALUES ($1, $2, $3, $4, 'invited')`,
          [name, emailValid, phoneRaw || null, phoneNorm]
        );
      }
      summary.created += 1;
    } catch (err) {
      summary.errors.push({ name, phone: phoneRaw, error: err.message });
    }
  }

  return summary;
}

async function parseXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    const values = row.values;
    // exceljs row.values is 1-indexed
    const cells = Array.isArray(values) ? values.slice(1) : [];
    const { name, phone } = pickNamePhone(cells);
    if (rowNumber === 1 && isHeaderRow(name, phone)) return;
    if (!name) return;
    rows.push({ name, phone });
  });
  return rows;
}

async function parseXlsxFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    const values = row.values;
    const cells = Array.isArray(values) ? values.slice(1) : [];
    const { name, phone } = pickNamePhone(cells);
    if (rowNumber === 1 && isHeaderRow(name, phone)) return;
    if (!name) return;
    rows.push({ name, phone });
  });
  return rows;
}

async function createManualClient({ name, phone, email, hasPerfiladoHistory = false }) {
  const nameTrim = String(name || '').trim();
  if (nameTrim.length < 2) {
    return { error: 'Nombre obligatorio', code: 'INVALID_NAME', status: 400 };
  }

  const phoneRaw = phone ? String(phone).trim() : '';
  const phoneNorm = normalizePhone(phoneRaw);
  const emailNorm = email ? String(email).trim().toLowerCase() : null;
  const emailValid = emailNorm && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm) ? emailNorm : null;

  if (!phoneNorm && !emailValid) {
    return { error: 'Indica al menos teléfono o email', code: 'MISSING_CONTACT', status: 400 };
  }

  if (phoneNorm) {
    const clash = await query(`SELECT id FROM clients WHERE phone_normalized = $1`, [phoneNorm]);
    if (clash.rows.length) {
      return { error: 'Ya existe un cliente con ese teléfono', code: 'PHONE_TAKEN', status: 409 };
    }
  }
  if (emailValid) {
    const clash = await query(`SELECT id FROM clients WHERE LOWER(email) = $1`, [emailValid]);
    if (clash.rows.length) {
      return { error: 'Ya existe un cliente con ese email', code: 'EMAIL_TAKEN', status: 409 };
    }
  }

  const perfiladoFlag = Boolean(hasPerfiladoHistory);
  const result = await query(
    `INSERT INTO clients (name, email, phone, phone_normalized, account_status, has_perfilado_history)
     VALUES ($1, $2, $3, $4, 'invited', $5)
     RETURNING id, name, email, phone, phone_normalized, account_status, has_perfilado_history, created_at, registered_at`,
    [nameTrim, emailValid, phoneRaw || null, phoneNorm, perfiladoFlag]
  );

  return { client: mapClientRow(result.rows[0]) };
}

async function findOrCreateByContact({ name, phone, email }) {
  const nameTrim = String(name || '').trim();
  const phoneRaw = phone ? String(phone).trim() : '';
  const phoneNorm = normalizePhone(phoneRaw);
  const emailNorm = email ? String(email).trim().toLowerCase() : null;
  const emailValid = emailNorm && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm) ? emailNorm : null;

  if (phoneNorm) {
    const existing = await query(`SELECT id FROM clients WHERE phone_normalized = $1`, [phoneNorm]);
    if (existing.rows[0]) return { clientId: existing.rows[0].id, created: false };
  }
  if (emailValid) {
    const existing = await query(`SELECT id FROM clients WHERE LOWER(email) = $1`, [emailValid]);
    if (existing.rows[0]) return { clientId: existing.rows[0].id, created: false };
  }

  try {
    const result = await query(
      `INSERT INTO clients (name, email, phone, phone_normalized, account_status)
       VALUES ($1, $2, $3, $4, 'invited')
       RETURNING id`,
      [nameTrim, emailValid, phoneRaw || null, phoneNorm]
    );
    return { clientId: result.rows[0].id, created: true };
  } catch (err) {
    if (err.code === '23505') {
      if (phoneNorm) {
        const again = await query(`SELECT id FROM clients WHERE phone_normalized = $1`, [phoneNorm]);
        if (again.rows[0]) return { clientId: again.rows[0].id, created: false };
      }
      if (emailValid) {
        const again = await query(`SELECT id FROM clients WHERE LOWER(email) = $1`, [emailValid]);
        if (again.rows[0]) return { clientId: again.rows[0].id, created: false };
      }
    }
    throw err;
  }
}

function mapClientRow(row) {
  return {
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
    bookingCount: row.booking_count != null ? Number(row.booking_count) : undefined,
    totalSpent: row.total_spent != null ? Number(row.total_spent) : undefined,
    hasInvite: row.has_invite != null ? Boolean(row.has_invite) : undefined,
    inviteExpiresAt: row.invite_expires_at,
    hasPerfiladoHistory: Boolean(row.has_perfilado_history),
  };
}

async function setAccountStatus(clientId, status) {
  if (!['invited', 'active', 'disabled'].includes(status)) {
    return { error: 'Estado no válido', code: 'INVALID_STATUS', status: 400 };
  }

  const existing = await query(`SELECT id, account_status, password_hash FROM clients WHERE id = $1`, [clientId]);
  if (!existing.rows.length) {
    return { error: 'Cliente no encontrado', code: 'NOT_FOUND', status: 404 };
  }

  let next = status;
  if (status === 'invited' && existing.rows[0].password_hash) {
    next = 'active';
  }
  if (status === 'active' && !existing.rows[0].password_hash) {
    next = 'invited';
  }

  const result = await query(
    `UPDATE clients SET account_status = $1 WHERE id = $2
     RETURNING id, name, email, phone, phone_normalized, account_status, created_at, registered_at`,
    [next, clientId]
  );

  return { client: mapClientRow(result.rows[0]) };
}

module.exports = {
  upsertClientRows,
  parseXlsxBuffer,
  parseXlsxFile,
  createManualClient,
  findOrCreateByContact,
  setAccountStatus,
  mapClientRow,
};
