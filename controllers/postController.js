require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

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

const MAX_CHARS = 480;
const BANNED_WORDS = [
  'mierda', 'pendejo', 'pendeja', 'estupido', 'estúpido', 'idiota',
  'imbecil', 'imbécil', 'maldito', 'maldita', 'cabrón', 'cabron',
  'puta', 'puto', 'joder', 'carajo', 'coño', 'gilipollas', 'chinga',
  'chingar', 'verga', 'culo', 'polla', 'zorra', 'maricón', 'maricon',
  'puta madre', 'hijo de puta', 'hijos de puta', 'la concha de tu madre',
  'me cago en', 'me cago en la', 'me cago en el', 'me cago en tus', 'me cago en tu',
  'chupapollas', 'chupapollas', 'cagada', 'cagar', 'cagarse',
  'come mierda', 'comemierda', 'chupamela', 'chúpamela', 'chupamelo', 'chúpamelo',
  'jodete', 'jódete', 'jodidos', 'jodidas', 'jodida', 'jodido', 'joderte', 'joderles',
  'porlagranputa', 'por la gran puta', 'hijueputa', 'hijo de la gran puta', 'hijos de la gran puta',
  'hijueputa', 'hijos de puta', 'la gran puta', 'malparido', 'malparida',
  'ijueputa'
];

const normalizeForCheck = (text) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const hasBannedWords = (text) => {
  const plain = normalizeForCheck(text).replace(/[^a-záéíóúüñ0-9\s]/gi, ' ');
  const tokens = plain.split(/\s+/).filter(Boolean);
  const bannedSet = new Set(BANNED_WORDS.map(normalizeForCheck));
  const found = Array.from(new Set(tokens.filter((t) => bannedSet.has(t))));
  return { found: found.length > 0, words: found };
};

const validateMensaje = (mensaje) => {
  if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
    return { ok: false, error: 'El mensaje es requerido.' };
  }
  if (mensaje.length > MAX_CHARS) {
    return { ok: false, error: `El mensaje supera el límite de ${MAX_CHARS} caracteres.` };
  }
  const { found, words } = hasBannedWords(mensaje);
  if (found) {
    return { ok: false, error: `El mensaje contiene palabras no permitidas: ${words.join(', ')}.` };
  }
  return { ok: true };
};

const crearPost = async (req, res) => {
  const { mensaje, imagen_url, imagenes_url } = req.body;
  const user_id = req.user?.id;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id (token) es requerido' });
  }

  const v = validateMensaje(mensaje);
  if (!v.ok) {
    return res.status(400).json({ error: v.error });
  }

  const { arr, first } = normalizeImages({ imagen_url, imagenes_url });

  const insertPayload = {
    user_id,
    mensaje,
    imagen_url: first,
    imagenes_url: arr,
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

const obtenerPosts = async (req, res) => {
  try {
    const hasPagination = typeof req.query.limit !== 'undefined';
    if (!hasPagination) {
      const { data, error } = await supabaseAdmin
        .from('posts')
        .select('id, mensaje, imagen_url, imagenes_url, created_at, user_id, usuarios(id, nombre, foto_url)')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: 'No se pudieron obtener los posts' });
      }
      return res.status(200).json(data);
    }

    const limitRaw = parseInt(String(req.query.limit || '10'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    let query = supabaseAdmin
      .from('posts')
      .select('id, mensaje, imagen_url, imagenes_url, created_at, user_id, usuarios(id, nombre, foto_url)')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'No se pudieron obtener los posts' });
    }

    const items = Array.isArray(data) ? data.slice(0, limit) : [];
    const hasMore = Array.isArray(data) && data.length > limit;
    const nextCursor = hasMore ? items[items.length - 1]?.created_at ?? null : null;

    return res.status(200).json({ items, nextCursor });
  } catch (e) {
    console.error('[obtenerPosts] error:', e);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizarPost = async (req, res) => {
  const { id } = req.params;
  const { mensaje, imagen_url, imagenes_url } = req.body;
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

  const updates = {};

  if (typeof mensaje === 'string') {
    const v = validateMensaje(mensaje);
    if (!v.ok) {
      return res.status(400).json({ error: v.error });
    }
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
