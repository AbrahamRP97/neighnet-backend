const rateLimit = require('express-rate-limit');

// Utilidad para mensajes consistentes
const toResponse = (message = 'Demasiadas solicitudes, intenta más tarde.') => ({
  statusCode: 429,
  message,
});

// 1) Limita intentos de login por IP
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 10,                  // 10 intentos cada 10 min
  standardHeaders: true,
  legacyHeaders: false,
  message: toResponse('Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.'),
});

// 2) Limita solicitudes de envío de correo de recuperación
const forgotPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutos
  max: 5,                   // 5 correos cada 30 min
  standardHeaders: true,
  legacyHeaders: false,
  message: toResponse('Has solicitado recuperación muchas veces. Vuelve a intentar más tarde.'),
});

// 3) Limita restablecimientos con token
const resetPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: toResponse('Demasiadas solicitudes de restablecimiento. Intenta más tarde.'),
});

// 4) Limita cambio de contraseña autenticado
const changePasswordLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: toResponse('Demasiados intentos de cambio de contraseña. Intenta luego.'),
});

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
};
