require('dotenv').config();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { generarToken } = require('../utils/jwt');
const { supabaseAdmin } = require('../supabaseClient');

// Twilio helpers
const { sendVerifyCode, checkVerifyCode } = require('../services/twilio');

// --- Helpers ---
const normalizePhone = (raw) => {
  // Solo acepta números de Honduras (+504XXXXXXXX) y USA (+1XXXXXXXXXX)
  const cleaned = (raw || '').replace(/\D/g, '');

  // Honduras: 8 dígitos, debe empezar con +504
  if (cleaned.length === 8) {
    return `+504${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('504')) {
    return `+${cleaned}`;
  }
  // USA: 10 dígitos, debe empezar con +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  // Si ya viene en formato correcto
  if (/^\+504\d{8}$/.test(raw) || /^\+1\d{10}$/.test(raw)) {
    return raw;
  }
  // Si no cumple, retorna vacío
  return '';
};

// Registrar usuario
const registrarUsuario = async (req, res) => {
  const { nombre, correo, contrasena, telefono, numero_casa } = req.body;

  if (!nombre || !correo || !contrasena || !telefono || !numero_casa) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const { data: existingUser } = await supabaseAdmin
    .from('usuarios')
    .select('correo')
    .eq('correo', correo)
    .single();

  if (existingUser) {
    return res.status(400).json({ error: 'El correo ya está registrado' });
  }

  const hash = await bcrypt.hash(contrasena, 10);
  const telefono_e164 = normalizePhone(telefono);

  const insertPayload = {
    nombre,
    correo,
    contrasena: hash,
    telefono,
    telefono_e164,
    telefono_verificado: false,
    numero_casa,
    rol: 'residente',
  };

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .insert([insertPayload])
    .select();

  if (error) {
    return res.status(500).json({ error: 'Error al registrar el usuario' });
  }

  const usuario = data[0];

  // Intenta enviar código SMS (no detiene el registro si falla)
  try {
    if (usuario.telefono_e164 || usuario.telefono) {
      await sendVerifyCode(usuario.telefono_e164 || usuario.telefono);
    }
  } catch (e) {
    console.error('[sendVerifyCode @register] error:', e?.message || e);
  }

  const payload = { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol };
  const token = generarToken(payload);

  // Puedes devolver token como antes; el frontend decidirá flujo (verificación antes de entrar).
  res.status(201).json({
    message: 'Usuario registrado correctamente. Verifica tu teléfono por SMS.',
    usuario: payload,
    token,
    needPhoneVerify: true,
  });
};

// Login usuario
const loginUsuario = async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  const { data: usuario, error } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('correo', correo)
    .single();

  if (error || !usuario) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const passwordOK = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!passwordOK) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // si no está verificado, enviamos código y devolvemos 403
  if (!usuario.telefono_verificado) {
    const phone = usuario.telefono_e164 || usuario.telefono || null;
    if (phone) {
      try {
        await sendVerifyCode(phone);
      } catch (e) {
        console.error('[loginUsuario/sendVerifyCode] ', e?.message || e);
      }
    }

    return res.status(403).json({
      error: 'Teléfono no verificado. Ingresa el código enviado por SMS.',
      needPhoneVerify: true,
      userId: usuario.id,
      telefono: phone,
      sent: !!phone, // hint para el frontend
    });
  }

  const payload = { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol };
  const token = generarToken(payload);
  res.status(200).json({ message: 'Login exitoso', usuario: payload, token });
};

// Obtener perfil usuario por :id (protegido)
const obtenerUsuario = async (req, res) => {
  const { id } = req.params;

  if (req.user?.id && String(req.user.id) !== String(id)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, correo, telefono, numero_casa, foto_url, rol, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('[obtenerUsuario] Supabase error:', {
      code: error?.code, message: error?.message, details: error?.details, hint: error?.hint,
      idConsultado: id, supabaseUrl: process.env.SUPABASE_URL,
    });
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  return res.json(data);
};

// Obtener perfil desde el token (protegido)
const obtenerUsuarioMe = async (req, res) => {
  const id = req.user?.id;
  if (!id) return res.status(401).json({ error: 'No autorizado' });

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, correo, telefono, numero_casa, foto_url, rol, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('[obtenerUsuarioMe] Supabase error:', {
      code: error?.code, message: error?.message, details: error?.details, hint: error?.hint,
      idConsultado: id, supabaseUrl: process.env.SUPABASE_URL
    });
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  return res.json(data);
};

// Actualizar usuario (protegido)
const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, telefono, numero_casa, foto_url, remove_avatar } = req.body;

  if (req.user?.id && String(req.user.id) !== String(id)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if (!nombre || !correo) {
    return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
  }

  const updatePayload = { nombre, correo, telefono, numero_casa };

  if (typeof telefono === 'string') {
    updatePayload.telefono_e164 = normalizePhone(telefono);
  }

  if (remove_avatar === true || (typeof foto_url === 'string' && foto_url.trim() === '')) {
    updatePayload.foto_url = null;
  } else if (typeof foto_url === 'string' && foto_url.trim().length > 0) {
    updatePayload.foto_url = foto_url;
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(updatePayload)
    .eq('id', id)
    .select('id, nombre, correo, telefono, numero_casa, foto_url, rol, updated_at');

  if (error) {
    console.error('[actualizarUsuario] Supabase update error:', {
      code: error.code, message: error.message, details: error.details, hint: error.hint,
      updatePayload,
    });
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }

  return res.status(200).json({ message: 'Perfil actualizado', data });
};

// Eliminar usuario (protegido, borra dependencias)
const eliminarUsuario = async (req, res) => {
  const { id } = req.params;

  // 🔒 Ownership
  if (req.user?.id && String(req.user.id) !== String(id)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  try {
    await supabaseAdmin.from('visitantes').delete().eq('usuario_id', id);
    await supabaseAdmin.from('posts').delete().eq('user_id', id);

    const { error } = await supabaseAdmin.from('usuarios').delete().eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Error al eliminar la cuenta' });
    }
    return res.status(200).json({ message: 'Cuenta eliminada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Cambiar contraseña (protegido)
const cambiarContrasena = async (req, res) => {
  const { id } = req.params;
  const oldPassword = req.body.oldPassword ?? req.body.currentPassword;
  const newPassword = req.body.newPassword;

  // 🔒 Ownership
  if (req.user?.id && String(req.user.id) !== String(id)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Debes ingresar la contraseña actual y la nueva' });
  }

  if (oldPassword === newPassword) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
  }

  const { data: usuario, error } = await supabaseAdmin
    .from('usuarios')
    .select('contrasena')
    .eq('id', id)
    .single();

  if (error || !usuario) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const passwordOK = await bcrypt.compare(oldPassword, usuario.contrasena);
  if (!passwordOK) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const { error: updateError } = await supabaseAdmin
    .from('usuarios')
    .update({ contrasena: hash })
    .eq('id', id);

  if (updateError) {
    return res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }

  res.json({ message: 'Contraseña cambiada exitosamente' });
};

// Forgot password — enviar correo recuperación (pública)
const forgotPassword = async (req, res) => {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'Correo requerido' });

  const { data: user } = await supabaseAdmin
    .from('usuarios')
    .select('correo')
    .eq('correo', correo)
    .single();

  // Siempre responder genérico por seguridad (no revelar si existe o no)
  if (!user) {
    return res.json({ message: 'Si el correo está registrado, se enviará un mail de recuperación' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await supabaseAdmin
    .from('password_resets')
    .insert([{ user_email: correo, token, expires_at: expiresAt }]);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  // 🚀 Nuevo: usar HTTPS "trampoline" que redirige a neighnet://reset-password?token=...
  const base = process.env.APP_PUBLIC_BASE_URL || 'https://neighnet-backend.onrender.com';
  const link = `${base}/api/auth/deeplink/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await transporter.sendMail({
      from: `NeighNet <${process.env.EMAIL_USER}>`,
      to: correo,
      subject: 'Restablece tu contraseña',
      text: `Hola,
Has solicitado restablecer tu contraseña en NeighNet.
Para crear una nueva contraseña, abre este enlace desde tu dispositivo con la app instalada:
${link}

Si no fuiste tú, ignora este mensaje.
Este enlace es válido por 1 hora.
`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;padding:24px;margin:auto;background:#f5faff;border-radius:12px">
          <h2 style="color:#1e90ff">Recupera tu contraseña</h2>
          <p>Hola,</p>
          <p>Haz clic en el botón para restablecer tu contraseña en <b>NeighNet</b>.</p>
          <p>
            <a href="${link}" style="background:#1e90ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
              Restablecer contraseña
            </a>
          </p>
          <p style="margin-top:14px">Si el botón no abre la app, copia y pega este enlace en tu navegador:</p>
          <p style="word-break:break-all;"><a href="${link}">${link}</a></p>
          <p style="font-size:13px;color:#888;margin-top:12px">Este enlace es válido por 1 hora.</p>
        </div>
      `,
    });
    res.json({ message: 'Correo enviado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo enviar el correo' });
  }
};


// Reset password — guardar nueva contraseña (pública)
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });

  const { data, error } = await supabaseAdmin
    .from('password_resets')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) return res.status(400).json({ error: 'Token inválido' });

  if (new Date(data.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Token expirado' });
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const { error: upErr } = await supabaseAdmin
    .from('usuarios')
    .update({ contrasena: hash })
    .eq('correo', data.user_email);

  if (upErr) {
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }

  await supabaseAdmin.from('password_resets').delete().eq('token', token);

  res.json({ message: 'Contraseña actualizada' });
};

// Guardar Expo Push Token (protegido)
const setPushToken = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { expo_push_token } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'No autenticado' });
    if (!expo_push_token) return res.status(400).json({ error: 'expo_push_token requerido' });

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update({ expo_push_token })
      .eq('id', userId)
      .select('id, expo_push_token')
      .single();

    if (error) return res.status(500).json({ error: 'No se pudo guardar el push token' });
    return res.json({ ok: true, expo_push_token: data.expo_push_token });
  } catch (e) {
    console.error('[setPushToken] error:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// --- Enviar y Verificar código SMS ---
const sendPhoneCode = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('telefono, telefono_e164, telefono_verificado')
      .eq('id', userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.telefono_verificado) return res.status(400).json({ error: 'Teléfono ya verificado' });

    const phone = user.telefono_e164 || user.telefono;
    if (!phone) return res.status(400).json({ error: 'Teléfono no definido' });

    await sendVerifyCode(phone);
    return res.json({ ok: true, message: 'Código enviado' });
  } catch (e) {
    console.error('[sendPhoneCode] error:', e?.message || e);
    return res.status(500).json({ error: 'No se pudo enviar el código' });
  }
};

const verifyPhoneCode = async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ error: 'userId y code requeridos' });

    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('telefono, telefono_e164, telefono_verificado')
      .eq('id', userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.telefono_verificado) return res.status(400).json({ error: 'Teléfono ya verificado' });

    const phone = user.telefono_e164 || user.telefono;
    if (!phone) return res.status(400).json({ error: 'Teléfono no definido' });

    const result = await checkVerifyCode(phone, code);
    if (result.status === 'approved') {
      await supabaseAdmin
        .from('usuarios')
        .update({ telefono_verificado: true, verificado_en: new Date().toISOString() })
        .eq('id', userId);

      return res.json({ ok: true, message: 'Teléfono verificado' });
    } else {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }
  } catch (e) {
    console.error('[verifyPhoneCode] error:', e?.message || e);
    return res.status(500).json({ error: 'No se pudo verificar el código' });
  }
};

module.exports = {
  loginUsuario,
  registrarUsuario,
  actualizarUsuario,
  obtenerUsuario,
  obtenerUsuarioMe,
  eliminarUsuario,
  forgotPassword,
  resetPassword,
  cambiarContrasena,
  setPushToken,
  sendPhoneCode,
  verifyPhoneCode,
};
