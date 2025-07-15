require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  // Arma el payload
  const insertPayload = {
    nombre, 
    correo, 
    contrasena, 
    telefono, 
    numero_casa, 
    rol: 'residente'
  };

  // Log del body recibido
  console.log('Body recibido en el request:', req.body);
  // Log del payload preparado para el insert
  console.log('Payload enviado al insert:', insertPayload);

  const { data, error } = await supabase
    .from('usuarios')
    .insert([insertPayload])
    .select();  // Devuelve el registro insertado

  if (error) {
    console.error('Error en insert:', error);
    return res.status(500).json({ error: 'Error al registrar el usuario' });
  }

  console.log('Insertado en Supabase:', data);
  res.status(201).json({ message: 'Usuario registrado correctamente', data });
};


const loginUsuario = async (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('correo', correo)
    .eq('contrasena', contrasena)
    .single();

  if (error || !usuario) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  res.status(200).json({ message: 'Login exitoso', usuario });
};

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

  res.json(data);
};

const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, telefono, numero_casa, foto_url } = req.body;

  // Validación básica
  if (!nombre || !correo || !telefono || !numero_casa) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const updatePayload = {
    nombre,
    correo,
    telefono,
    numero_casa,
  };

  // Solo agrega la foto si existe
  if (foto_url) {
    updatePayload.foto_url = foto_url;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(updatePayload)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error al actualizar perfil:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }

  res.status(200).json({ message: 'Perfil actualizado', data });
};


const eliminarUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar usuario:', error);
      return res.status(500).json({ error: 'Error al eliminar la cuenta' });
    }

    return res.status(200).json({ message: 'Cuenta eliminada correctamente' });
  } catch (err) {
    console.error('Error interno al eliminar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const forgotPassword = async (req, res) => {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'Correo requerido' });

  const { data: user } = await supabase
    .from('usuarios')
    .select('correo')
    .eq('correo', correo)
    .single();

  if (!user) return res.status(404).json({ error: 'Correo no registrado' });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await supabase
    .from('password_resets')
    .insert([{ user_email: correo, token, expires_at: expiresAt }]);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'tuemail@gmail.com',
      pass: 'tu_app_password', 
    },
  });

  const link = `neighnet://reset-password?token=${token}`;

  try {
    await transporter.sendMail({
      from: 'NeighNet <tuemail@gmail.com>',
      to: correo,
      subject: 'Restablece tu contraseña',
      text: `Abre la app NeighNet con este link:\n${link}`,
    });
    res.json({ message: 'Correo enviado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo enviar el correo' });
  }
};

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

  await supabase
    .from('usuarios')
    .update({ contrasena: newPassword })
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
