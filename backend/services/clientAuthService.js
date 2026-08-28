const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const { normalizePhone } = require('../utils/phone');

const INVITE_DAYS = 30;
const RESET_HOURS = 1;
const BCRYPT_ROUNDS = 12;

function signClientToken(clientId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ role: 'client', clientId }, secret, { expiresIn: '7d' });
}

function publicClient(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    accountStatus: row.account_status,
    registeredAt: row.registered_at,
    declaredProfile: row.declared_profile || null,
  };
}

function inviteUrl(token) {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!base) {
    return `/registro/${token}`;
  }
  return `${base}/registro/${token}`;
}

function resetPasswordUrl(token) {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!base) {
    return `/restablecer/${token}`;
  }
  return `${base}/restablecer/${token}`;
}

async function getInvitePreview(token) {
  const result = await query(
    `SELECT i.token, i.expires_at, i.used_at,
            c.id AS client_id, c.name, c.email, c.phone, c.account_status
     FROM client_invites i
     JOIN clients c ON c.id = i.client_id
     WHERE i.token = $1`,
    [token]
  );
  const row = result.rows[0];
  if (!row) return { error: 'Invitación no válida', code: 'INVALID_INVITE', status: 404 };
  if (row.used_at) return { error: 'Esta invitación ya fue usada', code: 'INVITE_USED', status: 410 };
  if (new Date(row.expires_at) < new Date()) {
    return { error: 'Esta invitación ha caducado', code: 'INVITE_EXPIRED', status: 410 };
  }
  if (row.account_status === 'disabled') {
    return { error: 'Esta cuenta está desactivada', code: 'ACCOUNT_DISABLED', status: 403 };
  }
  if (row.account_status === 'active') {
    return { error: 'Este cliente ya tiene cuenta. Inicia sesión.', code: 'ALREADY_REGISTERED', status: 409 };
  }

  return {
    invite: {
      name: row.name,
      email: row.email || '',
      phone: row.phone || '',
      expiresAt: row.expires_at,
    },
  };
}

async function registerWithInvite(token, { name, email, phone, password }) {
  if (!password || String(password).length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres', code: 'WEAK_PASSWORD', status: 400 };
  }

  const emailNorm = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return { error: 'Email no válido', code: 'INVALID_EMAIL', status: 400 };
  }

  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm) {
    return { error: 'Teléfono no válido (mínimo 9 dígitos)', code: 'INVALID_PHONE', status: 400 };
  }

  const nameTrim = String(name || '').trim();
  if (nameTrim.length < 2) {
    return { error: 'El nombre es obligatorio', code: 'INVALID_NAME', status: 400 };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const inviteRes = await client.query(
      `SELECT i.id AS invite_id, i.expires_at, i.used_at, c.id AS client_id, c.account_status
       FROM client_invites i
       JOIN clients c ON c.id = i.client_id
       WHERE i.token = $1
       FOR UPDATE OF i, c`,
      [token]
    );
    const invite = inviteRes.rows[0];
    if (!invite) {
      await client.query('ROLLBACK');
      return { error: 'Invitación no válida', code: 'INVALID_INVITE', status: 404 };
    }
    if (invite.used_at) {
      await client.query('ROLLBACK');
      return { error: 'Esta invitación ya fue usada', code: 'INVITE_USED', status: 410 };
    }
    if (new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return { error: 'Esta invitación ha caducado', code: 'INVITE_EXPIRED', status: 410 };
    }
    if (invite.account_status === 'disabled') {
      await client.query('ROLLBACK');
      return { error: 'Esta cuenta está desactivada', code: 'ACCOUNT_DISABLED', status: 403 };
    }
    if (invite.account_status === 'active') {
      await client.query('ROLLBACK');
      return { error: 'Este cliente ya tiene cuenta', code: 'ALREADY_REGISTERED', status: 409 };
    }

    const emailClash = await client.query(
      `SELECT id FROM clients WHERE LOWER(email) = $1 AND id <> $2`,
      [emailNorm, invite.client_id]
    );
    if (emailClash.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Este email ya está registrado', code: 'EMAIL_TAKEN', status: 409 };
    }

    const phoneClash = await client.query(
      `SELECT id FROM clients WHERE phone_normalized = $1 AND id <> $2`,
      [phoneNorm, invite.client_id]
    );
    if (phoneClash.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Este teléfono ya está registrado', code: 'PHONE_TAKEN', status: 409 };
    }

    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

    const updated = await client.query(
      `UPDATE clients
       SET name = $1,
           email = $2,
           phone = $3,
           phone_normalized = $4,
           password_hash = $5,
           account_status = 'active',
           registered_at = NOW()
       WHERE id = $6
       RETURNING id, name, email, phone, account_status, registered_at, declared_profile`,
      [nameTrim, emailNorm, String(phone).trim(), phoneNorm, passwordHash, invite.client_id]
    );

    await client.query(
      `UPDATE client_invites SET used_at = NOW() WHERE id = $1`,
      [invite.invite_id]
    );
    await client.query(
      `UPDATE client_invites
       SET used_at = COALESCE(used_at, NOW())
       WHERE client_id = $1 AND used_at IS NULL AND id <> $2`,
      [invite.client_id, invite.invite_id]
    );

    await client.query('COMMIT');

    const row = updated.rows[0];
    const authToken = signClientToken(row.id);
    return { token: authToken, user: publicClient(row) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function login(identifier, password) {
  const raw = String(identifier || '').trim();
  if (!raw || !password) {
    return { error: 'Email/teléfono y contraseña son obligatorios', code: 'MISSING_CREDENTIALS', status: 400 };
  }

  const phoneNorm = normalizePhone(raw);
  const emailNorm = raw.includes('@') ? raw.toLowerCase() : null;

  let result;
  if (emailNorm) {
    result = await query(
      `SELECT id, name, email, phone, account_status, registered_at, password_hash, declared_profile
       FROM clients WHERE LOWER(email) = $1`,
      [emailNorm]
    );
  } else if (phoneNorm) {
    result = await query(
      `SELECT id, name, email, phone, account_status, registered_at, password_hash, declared_profile
       FROM clients WHERE phone_normalized = $1`,
      [phoneNorm]
    );
  } else {
    return { error: 'Usa un email o teléfono válido', code: 'INVALID_IDENTIFIER', status: 400 };
  }

  const row = result.rows[0];
  if (!row || !row.password_hash) {
    return { error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS', status: 401 };
  }
  if (row.account_status === 'disabled') {
    return { error: 'Cuenta desactivada. Contacta con el estudio.', code: 'ACCOUNT_DISABLED', status: 403 };
  }
  if (row.account_status !== 'active') {
    return { error: 'Completa tu registro con el enlace de invitación', code: 'NOT_REGISTERED', status: 403 };
  }

  const match = await bcrypt.compare(String(password), row.password_hash);
  if (!match) {
    return { error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS', status: 401 };
  }

  return { token: signClientToken(row.id), user: publicClient(row) };
}

async function getClientById(clientId) {
  const result = await query(
    `SELECT id, name, email, phone, account_status, registered_at, declared_profile
     FROM clients WHERE id = $1`,
    [clientId]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.account_status !== 'active') return null;
  return publicClient(row);
}

async function updateDeclaredProfile(clientId, declaredProfile) {
  const allowed = ['first_time', 'returning_declared', 'returning_known'];
  if (!allowed.includes(declaredProfile)) {
    return { error: 'Perfil no válido', code: 'INVALID_PROFILE', status: 400 };
  }

  const result = await query(
    `UPDATE clients
     SET declared_profile = $1
     WHERE id = $2 AND account_status = 'active'
     RETURNING id, name, email, phone, account_status, registered_at, declared_profile`,
    [declaredProfile, clientId]
  );
  const row = result.rows[0];
  if (!row) return { error: 'Cliente no encontrado', code: 'NOT_FOUND', status: 404 };
  return { user: publicClient(row) };
}

async function createInviteForClient(clientId) {
  const clientRes = await query(
    `SELECT id, name, email, phone, account_status FROM clients WHERE id = $1`,
    [clientId]
  );
  const client = clientRes.rows[0];
  if (!client) return { error: 'Cliente no encontrado', code: 'NOT_FOUND', status: 404 };
  if (client.account_status === 'disabled') {
    return { error: 'Reactiva la cuenta antes de invitar', code: 'ACCOUNT_DISABLED', status: 400 };
  }
  if (client.account_status === 'active') {
    return { error: 'Este cliente ya está registrado', code: 'ALREADY_REGISTERED', status: 409 };
  }

  await query(
    `UPDATE client_invites SET used_at = NOW()
     WHERE client_id = $1 AND used_at IS NULL`,
    [clientId]
  );

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO client_invites (client_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [clientId, token, expiresAt]
  );

  if (client.account_status !== 'invited') {
    await query(`UPDATE clients SET account_status = 'invited' WHERE id = $1`, [clientId]);
  }

  return {
    inviteUrl: inviteUrl(token),
    token,
    expiresAt,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    },
  };
}

async function invalidatePasswordResetTokens(clientId) {
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW()
     WHERE client_id = $1 AND used_at IS NULL`,
    [clientId]
  );
}

async function createPasswordResetToken(clientId) {
  await invalidatePasswordResetTokens(clientId);
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000);
  await query(
    `INSERT INTO password_reset_tokens (client_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [clientId, token, expiresAt]
  );
  return { token, expiresAt, resetUrl: resetPasswordUrl(token) };
}

async function requestPasswordReset(email) {
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return { error: 'Email no válido', code: 'INVALID_EMAIL', status: 400 };
  }

  const result = await query(
    `SELECT id, name, email, account_status, password_hash
     FROM clients WHERE LOWER(email) = $1`,
    [emailNorm]
  );
  const row = result.rows[0];

  if (row && row.account_status === 'active' && row.password_hash && row.email) {
    const { token, resetUrl } = await createPasswordResetToken(row.id);
    try {
      const emailService = require('./emailService');
      await emailService.sendPasswordReset({
        to: row.email,
        name: row.name,
        resetUrl,
      });
    } catch (err) {
      console.error('Password reset email failed:', err.message);
    }
  }

  return {
    message: 'Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.',
  };
}

async function getPasswordResetPreview(token) {
  const result = await query(
    `SELECT prt.token, prt.expires_at, prt.used_at,
            c.name, c.email, c.account_status
     FROM password_reset_tokens prt
     JOIN clients c ON c.id = prt.client_id
     WHERE prt.token = $1`,
    [token]
  );
  const row = result.rows[0];
  if (!row) return { error: 'Enlace no válido', code: 'INVALID_TOKEN', status: 404 };
  if (row.used_at) return { error: 'Este enlace ya fue usado', code: 'TOKEN_USED', status: 410 };
  if (new Date(row.expires_at) < new Date()) {
    return { error: 'Este enlace ha caducado', code: 'TOKEN_EXPIRED', status: 410 };
  }
  if (row.account_status !== 'active') {
    return { error: 'Cuenta no disponible', code: 'ACCOUNT_DISABLED', status: 403 };
  }
  return {
    reset: {
      name: row.name,
      email: row.email,
      expiresAt: row.expires_at,
    },
  };
}

async function resetPasswordWithToken(token, password) {
  if (!password || String(password).length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres', code: 'WEAK_PASSWORD', status: 400 };
  }

  const preview = await getPasswordResetPreview(token);
  if (preview.error) return preview;

  const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const tokenRes = await client.query(
      `SELECT prt.id, prt.client_id
       FROM password_reset_tokens prt
       JOIN clients c ON c.id = prt.client_id
       WHERE prt.token = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()
         AND c.account_status = 'active'
       FOR UPDATE`,
      [token]
    );
    const row = tokenRes.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return { error: 'Enlace no válido o caducado', code: 'INVALID_TOKEN', status: 410 };
    }

    await client.query(
      `UPDATE clients SET password_hash = $1 WHERE id = $2`,
      [passwordHash, row.client_id]
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [row.id]
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE client_id = $1 AND used_at IS NULL`,
      [row.client_id]
    );
    await client.query('COMMIT');

    const userRes = await query(
      `SELECT id, name, email, phone, account_status, registered_at, declared_profile
       FROM clients WHERE id = $1`,
      [row.client_id]
    );
    return { message: 'Contraseña actualizada correctamente', user: publicClient(userRes.rows[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function sendPasswordResetForClient(clientId) {
  const result = await query(
    `SELECT id, name, email, account_status, password_hash FROM clients WHERE id = $1`,
    [clientId]
  );
  const row = result.rows[0];
  if (!row) return { error: 'Cliente no encontrado', code: 'NOT_FOUND', status: 404 };
  if (row.account_status !== 'active') {
    return { error: 'La cuenta no está activa', code: 'NOT_ACTIVE', status: 400 };
  }
  if (!row.password_hash) {
    return { error: 'Este cliente aún no tiene contraseña. Envía una invitación.', code: 'NO_PASSWORD', status: 400 };
  }
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return { error: 'El cliente no tiene un email válido', code: 'NO_EMAIL', status: 400 };
  }

  const { resetUrl, expiresAt } = await createPasswordResetToken(row.id);
  try {
    const emailService = require('./emailService');
    await emailService.sendPasswordReset({
      to: row.email,
      name: row.name,
      resetUrl,
    });
  } catch (err) {
    console.error('Owner password reset email failed:', err.message);
    return { error: 'No se pudo enviar el email', code: 'EMAIL_FAILED', status: 500 };
  }

  return {
    message: 'Enlace de restablecimiento enviado',
    resetUrl,
    expiresAt,
    client: { id: row.id, name: row.name, email: row.email },
  };
}

module.exports = {
  getInvitePreview,
  registerWithInvite,
  login,
  getClientById,
  updateDeclaredProfile,
  createInviteForClient,
  requestPasswordReset,
  getPasswordResetPreview,
  resetPasswordWithToken,
  sendPasswordResetForClient,
  inviteUrl,
  resetPasswordUrl,
  publicClient,
  INVITE_DAYS,
  RESET_HOURS,
};
