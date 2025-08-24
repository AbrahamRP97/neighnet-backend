require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

// Registrar visita (Entrada/Salida con expiración y máximo 2 lecturas)
const registrarVisita = async (req, res) => {
  try {
    let { id_qr, visitante_id, expires_at } = req.body;

    // Validar requeridos (tu regla actual)
    if (!id_qr || !visitante_id) {
      return res.status(400).json({ error: 'id_qr y visitante_id son obligatorios' });
    }

    // Normalizar tipos
    id_qr = String(id_qr).trim();
    visitante_id = String(visitante_id).trim();

    // Valida expires_at (ISO) — obligatorio para 1ª lectura
    let expiresAtDate = null;
    if (expires_at) {
      expiresAtDate = new Date(expires_at);
      if (isNaN(expiresAtDate.getTime())) {
        return res.status(400).json({ error: 'expires_at inválido' });
      }
    }

    // Buscar registros previos de este QR (ordenados por fecha)
    const { data: registros, error: qErr } = await supabaseAdmin
      .from('visitas')
      .select('id, tipo, fecha_hora, expires_at')
      .eq('id_qr', id_qr)
      .order('fecha_hora', { ascending: true });

    if (qErr) {
      console.error('[registrarVisita] query error:', qErr);
      return res.status(500).json({ error: 'Error al verificar visita' });
    }

    const now = new Date();

    // Caso 0: primera lectura -> ENTRADA
    if (!registros || registros.length === 0) {
      if (!expires_at) {
        return res.status(400).json({ error: 'expires_at es obligatorio en la primera lectura' });
      }
      if (now > expiresAtDate) {
        return res.status(400).json({ error: 'QR expirado' });
      }

      // (Opcional) capturar guardia que escanea
      const guardId = req.user?.id || null;

      const insertPayload = {
        id_qr,
        visitante_id,
        tipo: 'Entrada',
        fecha_hora: now.toISOString(),
        expires_at: expiresAtDate.toISOString(),
        ...(guardId ? { guard_id: guardId } : {}),
      };

      const { data, error } = await supabaseAdmin
        .from('visitas')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        console.error('[registrarVisita] insert Entrada error:', error, { insertPayload });
        return res.status(500).json({ error: 'Error al registrar entrada' });
      }
      return res.json({ message: 'Entrada registrada', data });
    }

    // Hay al menos una lectura previa; tomamos la primera para leer expires_at guardado
    const primera = registros[0];
    const expServer = primera?.expires_at ? new Date(primera.expires_at) : null;
    if (!expServer || isNaN(expServer.getTime())) {
      // fallback: si no estaba guardado por alguna razón, usar el que mande el cliente (si viene)
      if (!expires_at) {
        return res.status(400).json({ error: 'No se pudo validar expiración del QR' });
      }
      if (now > expiresAtDate) {
        return res.status(400).json({ error: 'QR expirado' });
      }
    } else {
      if (now > expServer) {
        return res.status(400).json({ error: 'QR expirado' });
      }
    }

    // Caso 1: segunda lectura -> SALIDA (solo si la última fue Entrada y no hay más)
    if (registros.length === 1 && registros[0].tipo === 'Entrada') {
      const guardId = req.user?.id || null;

      const insertPayload = {
        id_qr,
        visitante_id,
        tipo: 'Salida',
        fecha_hora: now.toISOString(),
        ...(guardId ? { guard_id: guardId } : {}),
      };

      const { data, error } = await supabaseAdmin
        .from('visitas')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        console.error('[registrarVisita] insert Salida error:', error, { insertPayload });
        return res.status(500).json({ error: 'Error al registrar salida' });
      }
      return res.json({ message: 'Salida registrada', data });
    }

    // Caso 2: tercera lectura o patrón inválido -> error
    return res.status(400).json({ error: 'QR inválido/utilizado/expirado' });
  } catch (err) {
    console.error('[registrarVisita] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { registrarVisita };
