require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

const ALLOWED_BUCKETS = new Set(['avatars', 'posts', 'evidencias']);

/**
 * POST /api/uploads/signed-url
 * Body: { fileName: string, contentType: string, bucket?: string }
 * Respuesta: { signedUrl, path, publicUrl, contentType }
 */
const createSignedUrl = async (req, res) => {
  try {
    let { fileName, contentType, bucket = 'posts' } = req.body || {};

    if (!fileName || !contentType) {
      return res.status(400).json({ error: 'fileName y contentType son requeridos' });
    }

    // Normaliza bucket y valida
    bucket = String(bucket).trim();
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return res.status(400).json({ error: 'Bucket no permitido' });
    }

    // Sanea el nombre de archivo: evita slashes y caracteres raros
    const safeName = String(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_');

    // Crea Signed Upload URL
    const { data, error } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUploadUrl(safeName);

    if (error || !data?.signedUrl) {
      console.error('[uploads] createSignedUploadUrl error:', error);
      return res
        .status(500)
        .json({ error: error?.message || 'No se pudo crear la URL firmada' });
    }

    // Public URL (el bucket debe ser public => true)
    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(safeName);
    const publicUrl = pub?.publicUrl || null;

    return res.json({
      signedUrl: data.signedUrl,
      path: data.path || safeName,
      publicUrl,
      contentType,
    });
  } catch (err) {
    console.error('[uploads] createSignedUrl exception:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

module.exports = { createSignedUrl };
