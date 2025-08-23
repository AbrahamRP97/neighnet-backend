const express = require('express');
const {
  registrarUsuario,
  loginUsuario,
  actualizarUsuario,
  obtenerUsuario,
  obtenerUsuarioMe,
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

const { verificarToken } = require('../utils/jwt');

const router = express.Router();

// ------------------- Rutas públicas -------------------
router.post('/register', passwordPolicy({ field: 'contrasena' }), registrarUsuario);
router.post('/login', loginLimiter, loginUsuario);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, passwordPolicy({ field: 'newPassword' }), resetPassword);

// 🔎 DIAGNÓSTICO (temporal, SIN auth): comprueba conexión a Supabase y tabla `usuarios`
router.get('/diag/ping', async (_req, res) => {
  try {
    const { supabaseAdmin } = require('../supabaseClient');
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, correo')
      .limit(1);

    const supabaseUrl = (process.env.SUPABASE_URL || '').slice(0, 40) + '...';
    const servicePrefix = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 12) + '...';
    const anonPrefix = (process.env.SUPABASE_ANON_KEY || '').slice(0, 12) + '...';

    res.json({
      ok: !error,
      rowsSeen: data?.length ?? 0,
      firstRow: data?.[0] || null,
      supabaseUrl,
      servicePrefix,
      anonPrefix,
      error: error ? {
        code: error.code, message: error.message, details: error.details, hint: error.hint
      } : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, reason: e?.message || String(e) });
  }
});

// 🔎 DIAGNÓSTICO JWT (temporal, SIN auth): verifica el token del header y devuelve payload o razón
router.get('/diag/jwt', (req, res) => {
  try {
    const rawHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!rawHeader) {
      return res.status(400).json({ ok: false, error: 'Falta header Authorization' });
    }
    const trimmed = String(rawHeader).trim();
    const parts = trimmed.split(' ').filter(Boolean);

    let token = '';
    if (parts.length === 1) token = parts[0];
    else if (parts.length === 2 && /^Bearer$/i.test(parts[0])) token = parts[1];
    else token = parts[parts.length - 1];

    if (!token) {
      return res.status(400).json({ ok: false, error: 'No se pudo extraer token' });
    }

    const payload = verificarToken(token);
    if (!payload) {
      return res.status(401).json({
        ok: false,
        error: 'Token inválido o expirado',
        info: {
          hasBearer: /^Bearer\s/i.test(trimmed),
          tokenLen: token.length,
          jwtSecretSet: !!process.env.JWT_SECRET,
          jwtSecretLen: (process.env.JWT_SECRET || '').length,
        }
      });
    }

    return res.json({
      ok: true,
      payload,
      jwtSecretSet: !!process.env.JWT_SECRET,
      jwtSecretLen: (process.env.JWT_SECRET || '').length,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ------------------- Rutas protegidas -------------------
router.use(authMiddleware);

// Perfil del usuario autenticado (desde token)
router.get('/me', obtenerUsuarioMe);

// CRUD perfil por id (mantén tus existentes)
router.put('/update/:id', actualizarUsuario);
router.get('/:id', obtenerUsuario);
router.delete('/delete/:id', eliminarUsuario);

router.put(
  '/cambiar-contrasena/:id',
  changePasswordLimiter,
  passwordPolicy({ field: 'newPassword' }),
  cambiarContrasena
);

router.put(
  '/change-password/:id',
  changePasswordLimiter,
  passwordPolicy({ field: 'newPassword' }),
  cambiarContrasena
);

module.exports = router;
