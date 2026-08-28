const { Router } = require('express');
const requireClientAuth = require('../middleware/requireClientAuth');
const clientAuth = require('../services/clientAuthService');
const clientBookings = require('../services/clientBookingsService');

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

router.post('/forgot-password', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.', code: 'RATE_LIMITED' });
    }
    const { email } = req.body || {};
    const result = await clientAuth.requestPasswordReset(email);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  try {
    const result = await clientAuth.getPasswordResetPreview(req.params.token);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Reset password preview error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    const result = await clientAuth.resetPasswordWithToken(token, password);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Reset password error:', err);
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

router.get('/bookings/mine', requireClientAuth, async (req, res) => {
  try {
    const tab = req.query.tab || 'upcoming';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await clientBookings.getClientBookings(req.clientAuth.clientId, {
      tab,
      page,
      limit,
    });
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Client bookings error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/bookings/mine/stats', requireClientAuth, async (req, res) => {
  try {
    const stats = await clientBookings.getClientBookingStats(req.clientAuth.clientId);
    res.json(stats);
  } catch (err) {
    console.error('Client booking stats error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
