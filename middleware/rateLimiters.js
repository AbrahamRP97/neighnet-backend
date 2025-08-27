const rateLimit = require('express-rate-limit');

// Utilidad para mensajes consistentes
const toResponse = (message = 'Demasiadas solicitudes, intenta más tarde.') => ({
  statusCode: 429,
  message,
});

// 1) Limita intentos de login por IP
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: toResponse('Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.'),
});

// 2) Limita solicitudes de envío de correo de recuperación
const forgotPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
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

// 5) Limita envío de código SMS
const phoneCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 envíos cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: toResponse('Has solicitado demasiados códigos. Intenta más tarde.'),
});

// 6) Limita verificación de código SMS
const phoneVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 intentos cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: toResponse('Demasiados intentos de verificación. Inténtalo luego.'),
});

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
  phoneCodeLimiter,
  phoneVerifyLimiter,
};
