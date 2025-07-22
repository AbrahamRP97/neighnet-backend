require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { generarToken } = require('../utils/jwt');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Registrar usuario
const registrarUsuario = async (req, res) => {
  const { nombre, correo, contrasena, telefono, numero_casa } = req.body;
  if (!nombre || !correo || !contrasena || !telefono || !numero_casa) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const { data: existingUser } = await supabase
    .from('usuarios')
    .select('correo')
    .eq('correo', correo)
    .single();
  if (existingUser) {
    return res.status(400).json({ error: 'El correo ya está registrado' });
  }

  const hash = await bcrypt.hash(contrasena, 10);
  const insertPayload = {
    nombre,
    correo,
    contrasena: hash,
    telefono,
    numero_casa,
    rol: 'residente'
  };

  const { data, error } = await supabase
    .from('usuarios')
    .insert([insertPayload])
    .select();

  if (error) {
    return res.status(500).json({ error: 'Error al registrar el usuario' });
  }

  const usuario = data[0];
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol
  };
  const token = generarToken(payload);

  res.status(201).json({ message: 'Usuario registrado correctamente', usuario: payload, token });
};

// Login usuario
const loginUsuario = async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  const { data: usuario, error } = await supabase
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

  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol
  };
  const token = generarToken(payload);

  res.status(200).json({ message: 'Login exitoso', usuario: payload, token });
};

// Obtener perfil usuario
const obtenerUsuario = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  if (data.contrasena) delete data.contrasena;
  res.json(data);
};

// Actualizar usuario
const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, telefono, numero_casa, foto_url } = req.body;

  if (!nombre || !correo || !telefono || !numero_casa) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const updatePayload = {
    nombre,
    correo,
    telefono,
    numero_casa,
  };

  if (foto_url && typeof foto_url === 'string' && foto_url.length > 0) {
    updatePayload.foto_url = foto_url;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(updatePayload)
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }

  res.status(200).json({ message: 'Perfil actualizado', data });
};

// Eliminar usuario
const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id);
    if (error) {
      return res.status(500).json({ error: 'Error al eliminar la cuenta' });
    }
    return res.status(200).json({ message: 'Cuenta eliminada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Forgot password — enviar correo recuperación
const forgotPassword = async (req, res) => {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'Correo requerido' });

  const { data: user } = await supabase
    .from('usuarios')
    .select('correo')
    .eq('correo', correo)
    .single();

  // Respuesta genérica para evitar filtrado de usuarios (opcional, best-practice)
  if (!user) {
    return res.json({ message: 'Si el correo está registrado, se enviará un mail de recuperación' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await supabase
    .from('password_resets')
    .insert([{ user_email: correo, token, expires_at: expiresAt }]);

    console.log('EMAIL_USER', process.env.EMAIL_USER);
    console.log('EMAIL_PASS', process.env.EMAIL_PASS ? '***' : 'No configurado');
    
  // Usa variables de entorno para datos de Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,    // <--- .env
      pass: process.env.EMAIL_PASS,    // <--- .env
    },
  });

  const link = `neighnet://reset-password?token=${token}`;
  try {
    await transporter.sendMail({
      from: `NeighNet <${process.env.EMAIL_USER}>`,
      to: correo,
      subject: 'Restablece tu contraseña',
      text: `Hola,
Has solicitado restablecer tu contraseña en NeighNet.
Para crear una nueva contraseña, haz clic en el siguiente enlace o ábrelo desde la app:
${link}
Si no solicitaste este cambio, puedes ignorar este mensaje.
Saludos,
El equipo de NeighNet
`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;padding:24px;margin:auto;background:#f5faff;border-radius:12px">
          <h2 style="color:#1e90ff">Recupera tu contraseña</h2>
          <p>Hola,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña en <b>NeighNet</b>.</p>
          <p>
            <a href="${link}" style="background:#1e90ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
              Restablecer contraseña
            </a>
          </p>
          <p>Si no fuiste tú, simplemente ignora este mensaje.</p>
          <br>
          <p style="font-size:13px;color:#888">Este enlace es válido por 1 hora.</p>
          <hr style="border:none;border-top:1px solid #eee">
          <p style="font-size:12px;color:#999">© 2025 NeighNet</p>
        </div>
      `,
    });
    res.json({ message: 'Correo enviado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo enviar el correo' });
  }
};

// Reset password — guardar nueva contraseña
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });

  const { data, error } = await supabase
    .from('password_resets')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) return res.status(400).json({ error: 'Token inválido' });

  if (new Date(data.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Token expirado' });
  }

  // HASH la nueva contraseña antes de guardar
  const hash = await bcrypt.hash(newPassword, 10);

  await supabase
    .from('usuarios')
    .update({ contrasena: hash })
    .eq('correo', data.user_email);

  await supabase
    .from('password_resets')
    .delete()
    .eq('token', token);

  res.json({ message: 'Contraseña actualizada' });
};

module.exports = {
  loginUsuario,
  registrarUsuario,
  actualizarUsuario,
  obtenerUsuario,
  eliminarUsuario,
  forgotPassword,
  resetPassword
};
