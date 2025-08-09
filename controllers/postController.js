require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

// Crear una nueva publicación
const crearPost = async (req, res) => {
  const { mensaje, imagen_url } = req.body;
  const user_id = req.user?.id;

  if (!user_id || !mensaje) {
    return res.status(400).json({ error: 'user_id (token) y mensaje son requeridos' });
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert([{ user_id, mensaje, imagen_url }])
    .select();

  if (error) {
    return res.status(500).json({ error: 'No se pudo crear el post' });
  }

  res.status(201).json({ message: 'Post creado exitosamente', data });
};

// Obtener todas las publicaciones (con nombre del usuario)
const obtenerPosts = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('id, mensaje, imagen_url, created_at, user_id, usuarios(id, nombre, foto_url)')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'No se pudieron obtener los posts' });
  }

  res.status(200).json(data);
};

// Actualizar un post (solo si es dueño)
const actualizarPost = async (req, res) => {
  const { id } = req.params;
  const { mensaje, imagen_url } = req.body;
  const user_id = req.user?.id;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!post) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }
  if (post.user_id !== user_id) {
    return res.status(403).json({ error: 'No tienes permiso para editar este post' });
  }

  const updates = { mensaje };
  if (imagen_url !== undefined) updates.imagen_url = imagen_url;

  const { data, error } = await supabaseAdmin
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: 'No se pudo actualizar el post' });
  }

  res.status(200).json({ message: 'Post actualizado', data: data[0] });
};

// Eliminar un post (solo si es dueño)
const eliminarPost = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!post) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }
  if (post.user_id !== user_id) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar este post' });
  }

  const { error } = await supabaseAdmin
    .from('posts')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: 'No se pudo eliminar el post' });
  }

  res.status(200).json({ message: 'Post eliminado correctamente' });
};

module.exports = {
  crearPost,
  obtenerPosts,
  actualizarPost,
  eliminarPost,
};
