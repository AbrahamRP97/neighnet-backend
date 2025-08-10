require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

// Normaliza el array de imágenes manteniendo compatibilidad con imagen_url
function normalizeImages({ imagen_url, imagenes_url }) {
  if (Array.isArray(imagenes_url)) {
    const arr = imagenes_url.filter(Boolean);
    return { arr, first: arr[0] ?? null };
  }
  if (imagen_url) {
    return { arr: [imagen_url], first: imagen_url };
  }
  return { arr: [], first: null };
}

// Crear una nueva publicación
const crearPost = async (req, res) => {
  const { mensaje, imagen_url, imagenes_url } = req.body;
  const user_id = req.user?.id;

  if (!user_id || !mensaje) {
    return res.status(400).json({ error: 'user_id (token) y mensaje son requeridos' });
  }

  const { arr, first } = normalizeImages({ imagen_url, imagenes_url });

  const insertPayload = {
    user_id,
    mensaje,
    imagen_url: first,     // compat con clientes antiguos
    imagenes_url: arr,     // multi-imagen
  };

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert([insertPayload])
    .select('id, mensaje, imagen_url, imagenes_url, created_at, user_id, usuarios(id, nombre, foto_url)');

  if (error) {
    return res.status(500).json({ error: 'No se pudo crear el post' });
  }

  res.status(201).json({ message: 'Post creado exitosamente', data });
};

// Obtener todas las publicaciones (con nombre del usuario)
const obtenerPosts = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('id, mensaje, imagen_url, imagenes_url, created_at, user_id, usuarios(id, nombre, foto_url)')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'No se pudieron obtener los posts' });
  }

  res.status(200).json(data);
};

// Actualizar un post (solo si es dueño)
const actualizarPost = async (req, res) => {
  const { id } = req.params;
  const { mensaje, imagen_url, imagenes_url } = req.body;
  const user_id = req.user?.id;

  // Verifica dueño
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

  // Reglas:
  // - Si viene imagenes_url, manda ese array y sincroniza imagen_url = first
  // - Si NO viene imagenes_url y sí viene imagen_url, coloca imagenes_url=[imagen_url]
  // - Si no viene nada de imágenes, no toques imágenes
  const updates = {};
  if (typeof mensaje === 'string') {
    updates.mensaje = mensaje;
  }

  if (Array.isArray(imagenes_url)) {
    const arr = imagenes_url.filter(Boolean);
    updates.imagenes_url = arr;
    updates.imagen_url = arr[0] ?? null;
  } else if (imagen_url !== undefined) {
    if (imagen_url) {
      updates.imagenes_url = [imagen_url];
      updates.imagen_url = imagen_url;
    } else {
      // imagen_url null/empty -> sin imágenes
      updates.imagenes_url = [];
      updates.imagen_url = null;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select('id, mensaje, imagen_url, imagenes_url, created_at, user_id, usuarios(id, nombre, foto_url)');

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
