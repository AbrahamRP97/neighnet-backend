require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const registrarUsuario = async (req, res) => {
  const { nombre, correo, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
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

  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ nombre, correo, contrasena, rol: 'residente' }]);

  if (error) return res.status(500).json({ error: 'Error al registrar el usuario' });

  res.status(201).json({ message: 'Usuario registrado correctamente' });
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

  const { data, error } = await supabase
    .from('usuarios')
    .update({
      nombre,
      correo,
      telefono,
      numero_casa,
      foto_url
    })
    .eq('id', id);

  if (error) {
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



module.exports = { loginUsuario, registrarUsuario, actualizarUsuario, obtenerUsuario, eliminarUsuario };
