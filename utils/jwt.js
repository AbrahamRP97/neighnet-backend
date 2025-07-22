const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'unsecretoseguro';

function generarToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verificarToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { generarToken, verificarToken };
