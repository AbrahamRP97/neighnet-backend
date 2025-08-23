require('dotenv').config();
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;


if (!SECRET || String(SECRET).trim() === '') {
  console.error('[utils/jwt] FALTA JWT_SECRET en variables de entorno');
  throw new Error('JWT_SECRET no definido');
}

function generarToken(payload, opciones = {}) {
  const opts = { algorithm: 'HS256', expiresIn: '7d', ...opciones };
  return jwt.sign(payload, SECRET, opts);
}

function verificarToken(token) {
  try {
    return jwt.verify(token, SECRET, { algorithms: ['HS256'], clockTolerance: 30 });
  } catch (_err) {
    return null;
  }
}

module.exports = { generarToken, verificarToken };
