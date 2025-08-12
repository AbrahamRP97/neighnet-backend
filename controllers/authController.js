require('dotenv').config();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { generarToken } = require('../utils/jwt');
const { supabaseAdmin } = require('../supabaseClient');

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
  const insertPayload = {
    nombre,
    correo,
    contrasena: hash,
    telefono,
    numero_casa,
    rol: 'residente'
  };

  const { data, error } = await supabaseAdmin
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

  const { data, error } = await supabaseAdmin
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

  const updatePayload = { nombre, correo, telefono, numero_casa };
  if (foto_url && typeof foto_url === 'string' && foto_url.length > 0) {
    updatePayload.foto_url = foto_url;
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(updatePayload)
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }

  res.status(200).json({ message: 'Perfil actualizado', data });
};

// Eliminar usuario (borra visitantes y posts antes)
const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await supabaseAdmin.from('visitantes').delete().eq('usuario_id', id);
    await supabaseAdmin.from('posts').delete().eq('user_id', id);

    const { error } = await supabaseAdmin
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

// Cambiar contraseña
const cambiarContrasena = async (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Debes ingresar la contraseña actual y la nueva' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
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

// Forgot password — enviar correo recuperación
const forgotPassword = async (req, res) => {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'Correo requerido' });

  const { data: user } = await supabaseAdmin
    .from('usuarios')
    .select('correo')
    .eq('correo', correo)
    .single();

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

  const link = `neighnet://reset-password?token=${token}`;
  try {
    await transporter.sendMail({
      from: `NeighNet <${process.env.EMAIL_USER}>`,
      to: correo,
      subject: 'Restablece tu contraseña',
      text: `Hola,
Has solicitado restablecer tu contraseña en NeighNet.
Para crear una nueva contraseña, abre este enlace desde la app:
${link}
Si no fuiste tú, ignora este mensaje.
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
          <p>Si no fuiste tú, simplemente ignora este mensaje.</p>
          <p style="font-size:13px;color:#888">Este enlace es válido por 1 hora.</p>
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

  await supabaseAdmin
    .from('usuarios')
    .update({ contrasena: hash })
    .eq('correo', data.user_email);

  await supabaseAdmin
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
  resetPassword,
  cambiarContrasena
};
