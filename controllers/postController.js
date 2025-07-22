const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Crear una nueva publicación
const crearPost = async (req, res) => {
  const { mensaje, imagen_url } = req.body;
  const user_id = req.user?.id; // del token

  if (!user_id || !mensaje) {
    return res.status(400).json({ error: 'user_id (token) y mensaje son requeridos' });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert([{ user_id, mensaje, imagen_url }]);

  if (error) {
    return res.status(500).json({ error: 'No se pudo crear el post' });
  }

  res.status(201).json({ message: 'Post creado exitosamente', data });
};

// Obtener todas las publicaciones (con nombre del usuario)
const obtenerPosts = async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, mensaje, imagen_url, created_at, user_id, usuarios(nombre, foto_url)')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'No se pudieron obtener los posts' });
  }

  res.status(200).json(data);
};

// Eliminar un post (solo si es dueño)
const eliminarPost = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id;

  // Verificar dueño
  const { data: post } = await supabase
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

  const { error } = await supabase
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
  eliminarPost,
};
