require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service Role: bypass RLS
);

/**
 * POST /api/uploads/signed-url
 * Body: { fileName: string, contentType: string, bucket?: string }
 * Respuesta: { signedUrl, path, publicUrl, contentType }
 */
const createSignedUrl = async (req, res) => {
  try {
    const { fileName, contentType, bucket = 'posts' } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({ error: 'fileName y contentType son requeridos' });
    }

    const { data, error } = await supabase
      .storage
      .from(bucket)
      .createSignedUploadUrl(fileName);

    if (error) {
      console.error('createSignedUploadUrl error:', error);
      return res.status(500).json({ error: 'No se pudo crear la URL firmada' });
    }

    const { signedUrl, path } = data;

    // URL pública para mostrar la imagen
    const pub = supabase.storage.from(bucket).getPublicUrl(path);

    return res.json({
      signedUrl,
      path,
      publicUrl: pub?.data?.publicUrl || null,
      contentType
    });
  } catch (err) {
    console.error('createSignedUrl exception:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

module.exports = {
  createSignedUrl,
};
