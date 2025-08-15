const { verificarToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  try {
    const rawHeader =
      req.headers['authorization'] || req.headers['Authorization'];

    if (!rawHeader) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const trimmed = String(rawHeader).trim();
    const parts = trimmed.split(' ').filter(Boolean);

    let token = '';
    if (parts.length === 1) {

      token = parts[0];
    } else if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    } else {

      token = parts[parts.length - 1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = verificarToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.user = decoded;
    return next();
  } catch (err) {
    console.error('[authMiddleware] error:', err?.message || err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = authMiddleware;
