const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/pool');

const TOKEN_TTL_DAYS = 7;

async function createOwnerActionToken({ action, entityType, entityId }) {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  await query(
    `INSERT INTO owner_action_tokens (token, action, entity_type, entity_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [token, action, entityType, entityId, expiresAt.toISOString()]
  );

  return token;
}

async function consumeOwnerActionToken(token, expectedAction) {
  const result = await query(
    `SELECT * FROM owner_action_tokens
     WHERE token = $1 AND action = $2 AND used_at IS NULL AND expires_at > NOW()`,
    [token, expectedAction]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  await query(`UPDATE owner_action_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
  return row;
}

function buildOwnerActionUrl(token, action) {
  const base = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${base}/api/owner/henna/${token}/${action}`;
}

module.exports = {
  createOwnerActionToken,
  consumeOwnerActionToken,
  buildOwnerActionUrl,
};
