require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

/**
 * GET /api/auth/public/:id
 * Devuelve solo campos públicos: id, nombre, telefono, foto_url
 * (sin requerir que sea el dueño del perfil)
 */
async function obtenerUsuarioPublico(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Falta id' });

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, telefono, foto_url')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[obtenerUsuarioPublico] error supabase:', error);
      return res.status(500).json({ error: 'Error al obtener perfil' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[obtenerUsuarioPublico] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { obtenerUsuarioPublico };
