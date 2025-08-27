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
  setPushToken
} = require('../controllers/authController');

const { obtenerUsuarioPublico } = require('../controllers/authPublicController'); // 👈 NUEVO
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

// 🔎 DIAGNÓSTICO (SIN auth): conexión a Supabase/tabla `usuarios`
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

// 🔎 DIAGNÓSTICO JWT (SIN auth): valida token y devuelve payload
router.get('/diag/jwt', (req, res) => {
  try {
    const raw = req.headers.authorization || req.headers.Authorization;
    if (!raw) return res.status(400).json({ ok: false, error: 'Falta Authorization' });

    const parts = String(raw).trim().split(' ').filter(Boolean);
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : parts[0];
    if (!token) return res.status(400).json({ ok: false, error: 'No token' });

    const payload = verificarToken(token);
    if (!payload) return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });

    return res.json({
      ok: true,
      payload,
      jwtSecretSet: !!process.env.JWT_SECRET,
      jwtSecretLen: (process.env.JWT_SECRET || '').length
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// 🔎 DIAGNÓSTICO LOOKUP (SIN auth): con el MISMO token busca por id y por correo
router.get('/diag/lookup', async (req, res) => {
  try {
    const raw = req.headers.authorization || req.headers.Authorization;
    if (!raw) return res.status(400).json({ ok: false, error: 'Falta Authorization' });

    const parts = String(raw).trim().split(' ').filter(Boolean);
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : parts[0];

    const payload = verificarToken(token);
    if (!payload?.id || !payload?.correo) {
      return res.status(400).json({ ok: false, error: 'Token sin id/correo', payload });
    }

    const { supabaseAdmin } = require('../supabaseClient');

    const byId = await supabaseAdmin
      .from('usuarios')
      .select('id, correo, nombre')
      .eq('id', payload.id)
      .maybeSingle();

    const byMail = await supabaseAdmin
      .from('usuarios')
      .select('id, correo, nombre')
      .eq('correo', payload.correo)
      .maybeSingle();

    res.json({
      ok: true,
      tokenPayload: payload,
      byId: { data: byId.data, error: byId.error ? { code: byId.error.code, message: byId.error.message } : null },
      byMail: { data: byMail.data, error: byMail.error ? { code: byMail.error.code, message: byMail.error.message } : null },
      supabaseUrl: process.env.SUPABASE_URL,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Público (limitado): ver perfil básico de otro usuario
router.get('/public/:id', obtenerUsuarioPublico);

// ------------------- Rutas protegidas -------------------
router.use(authMiddleware);

// Perfil del usuario autenticado (desde token)
router.get('/me', obtenerUsuarioMe);

// CRUD perfil por id
router.put('/update/:id', actualizarUsuario);
router.get('/:id', obtenerUsuario);
router.delete('/delete/:id', eliminarUsuario);
router.post('/set-push-token', setPushToken);

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
