require('dotenv').config();
const { SignJWT } = require('jose');
const { supabaseAdmin } = require('../supabaseClient');
const { ALG, getPrivateKey, getPublicJwk } = require('../utils/qrSigningKeys');

const randomId = (len = 8) =>
  [...crypto.getRandomValues(new Uint8Array(len))]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * POST /api/passes
 * Body: { visitante_id: string, ttl_hours?: number, meta?: object }
 * Auth: user (residente)
 * Respuesta: { envelope: string, pass: { id_qr, visitante_id, issued_at, expires_at, nonce } }
 */
const createSignedPass = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { visitante_id, ttl_hours = 24, meta = {} } = req.body || {};
    if (!visitante_id) {
      return res.status(400).json({ error: 'visitante_id es obligatorio' });
    }

    // Verifica que el visitante pertenezca al residente autenticado
    const { data: visitante, error: visErr } = await supabaseAdmin
      .from('visitantes')
      .select('id, residente_id')
      .eq('id', visitante_id)
      .single();

    if (visErr || !visitante) return res.status(404).json({ error: 'Visitante no encontrado' });
    if (visitante.residente_id !== userId) return res.status(403).json({ error: 'No autorizado' });

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + Math.max(1, Math.min(72, Number(ttl_hours))) * 3600;

    const id_qr = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nonce = randomId(4);

    const payload = {
      id_qr,
      visitante_id: String(visitante_id),
      iat: nowSec,
      exp: expSec,
      nonce,
      iss: 'neighnet',
      aud: 'vigilancia',
      meta,
    };

    const privKey = await getPrivateKey();
    const { kid } = getPublicJwk() || {};

    const envelope = await new SignJWT(payload)
      .setProtectedHeader({ alg: ALG, kid })
      .sign(privKey);

    return res.status(201).json({
      envelope,
      pass: {
        id_qr,
        visitante_id: String(visitante_id),
        issued_at: new Date(nowSec * 1000).toISOString(),
        expires_at: new Date(expSec * 1000).toISOString(),
        nonce,
      },
    });
  } catch (err) {
    console.error('[createSignedPass] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { createSignedPass };
