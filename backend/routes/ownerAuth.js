const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requireOwnerAuth = require('../middleware/requireOwnerAuth');

const router = Router();

const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count += 1;
  loginAttempts.set(ip, entry);
  return entry.count <= MAX_ATTEMPTS;
}

router.post('/auth/login', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.', code: 'RATE_LIMITED' });
    }

    const { email, password } = req.body || {};
    const ownerEmail = process.env.OWNER_DASHBOARD_EMAIL;
    const passwordHash = process.env.OWNER_DASHBOARD_PASSWORD_HASH;
    const secret = process.env.JWT_SECRET;

    if (!ownerEmail || !passwordHash || !secret) {
      return res.status(503).json({ error: 'Panel no configurado', code: 'AUTH_NOT_CONFIGURED' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos', code: 'MISSING_CREDENTIALS' });
    }

    const emailMatch = String(email).trim().toLowerCase() === ownerEmail.trim().toLowerCase();
    const passwordMatch = await bcrypt.compare(String(password), passwordHash);

    if (!emailMatch || !passwordMatch) {
      return res.status(401).json({ error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS' });
    }

    const token = jwt.sign({ email: ownerEmail, role: 'owner' }, secret, { expiresIn: '7d' });

    res.json({
      token,
      user: { email: ownerEmail, role: 'owner' },
    });
  } catch (err) {
    console.error('Owner login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/auth/me', requireOwnerAuth, (req, res) => {
  res.json({ user: { email: req.owner.email, role: 'owner' } });
});

module.exports = router;
