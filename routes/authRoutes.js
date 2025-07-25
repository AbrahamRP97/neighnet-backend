const express = require('express');
const {
  registrarUsuario,
  loginUsuario,
  actualizarUsuario,
  obtenerUsuario,
  eliminarUsuario,
  forgotPassword,
  resetPassword,
  cambiarContrasena
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', registrarUsuario);
router.post('/login', loginUsuario);
router.put('/update/:id', actualizarUsuario);
router.get('/:id', obtenerUsuario);
router.delete('/delete/:id', eliminarUsuario);

// Ruta para cambiar contraseña
router.put('/cambiar-contrasena/:id', cambiarContrasena);

// Rutas para recuperación de contraseña
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
