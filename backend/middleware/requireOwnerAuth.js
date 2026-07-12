const jwt = require('jsonwebtoken');

function requireOwnerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado', code: 'UNAUTHORIZED' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Panel no configurado', code: 'AUTH_NOT_CONFIGURED' });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (payload.role !== 'owner') {
      return res.status(403).json({ error: 'Acceso denegado', code: 'FORBIDDEN' });
    }
    req.owner = { email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada', code: 'INVALID_TOKEN' });
  }
}

module.exports = requireOwnerAuth;
