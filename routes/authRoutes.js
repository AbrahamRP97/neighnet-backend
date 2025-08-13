const express = require('express');
const {
  registrarUsuario,
  loginUsuario,
  actualizarUsuario,
  obtenerUsuario,
  eliminarUsuario,
  forgotPassword,
  resetPassword,
  cambiarContrasena,
} = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');
const passwordPolicy = require('../middleware/passwordPolicy');
const {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
} = require('../middleware/rateLimiters');

const router = express.Router();

// Rutas públicas
router.post('/register', passwordPolicy({ field: 'contrasena' }), registrarUsuario);
router.post('/login', loginLimiter, loginUsuario);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, passwordPolicy({ field: 'newPassword' }), resetPassword);

// Rutas protegidas
router.use(authMiddleware);

// Perfil
router.put('/update/:id', actualizarUsuario);
router.get('/:id', obtenerUsuario);
router.delete('/delete/:id', eliminarUsuario);

// Cambiar contraseña (usa 'newPassword' en el body) + rate limit
router.put(
  '/cambiar-contrasena/:id',
  changePasswordLimiter,
  passwordPolicy({ field: 'newPassword' }),
  cambiarContrasena
);

// Alias por compatibilidad con el frontend (/change-password/:id)
router.put(
  '/change-password/:id',
  changePasswordLimiter,
  passwordPolicy({ field: 'newPassword' }),
  cambiarContrasena
);

module.exports = router;
