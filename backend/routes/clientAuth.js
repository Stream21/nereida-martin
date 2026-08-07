const { Router } = require('express');
const requireClientAuth = require('../middleware/requireClientAuth');
const clientAuth = require('../services/clientAuthService');

const router = Router();

const loginAttempts = new Map();
const MAX_ATTEMPTS = 15;
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

router.get('/invite/:token', async (req, res) => {
  try {
    const result = await clientAuth.getInvitePreview(req.params.token);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Invite preview error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/register/:token', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    const result = await clientAuth.registerWithInvite(req.params.token, {
      name,
      email,
      phone,
      password,
    });
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Client register error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email o teléfono ya registrado', code: 'DUPLICATE' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.', code: 'RATE_LIMITED' });
    }

    const { identifier, email, phone, password } = req.body || {};
    const id = identifier || email || phone;
    const result = await clientAuth.login(id, password);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Client login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/me', requireClientAuth, async (req, res) => {
  try {
    const user = await clientAuth.getClientById(req.clientAuth.clientId);
    if (!user) {
      return res.status(401).json({ error: 'Sesión no válida', code: 'UNAUTHORIZED' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Client me error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/me', requireClientAuth, async (req, res) => {
  try {
    const { declaredProfile } = req.body || {};
    if (!declaredProfile) {
      return res.status(400).json({ error: 'declaredProfile es obligatorio' });
    }
    const result = await clientAuth.updateDeclaredProfile(
      req.clientAuth.clientId,
      declaredProfile
    );
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Client profile update error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
