require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

// Registrar visita (Entrada/Salida con expiración y máximo 2 lecturas)
const registrarVisita = async (req, res) => {
  try {
    let { id_qr, visitante_id, expires_at } = req.body;

    if (!id_qr || !visitante_id) {
      return res.status(400).json({ error: 'id_qr y visitante_id son obligatorios' });
    }

    // Normalizar
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

    // Buscar registros previos de este QR
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
      // ⬅️ devolvemos la visita creada con su ID para la pantalla de evidencia
      return res.json({ message: 'Entrada registrada', data });
    }

    // Hay al menos una lectura previa; tomamos la primera para leer expires_at guardado
    const primera = registros[0];
    const expServer = primera?.expires_at ? new Date(primera.expires_at) : null;
    if (!expServer || isNaN(expServer.getTime())) {
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

    // Caso 1: segunda lectura -> SALIDA (si la última fue Entrada)
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

/**
 * PUT /api/vigilancia/visitas/:id/evidencia
 * Body: { cedula_url?: string, placa_url?: string }
 * - Solo aplica para visitas de tipo 'Entrada' (la evidencia se adjunta a la entrada).
 * - Requiere rol vigilancia/admin (ya aplicado en la ruta).
 */
const adjuntarEvidencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { cedula_url, placa_url } = req.body || {};

    if (!id) return res.status(400).json({ error: 'Falta id de la visita' });
    if (!cedula_url && !placa_url) {
      return res.status(400).json({ error: 'Debes proporcionar al menos una URL (cedula_url o placa_url)' });
    }

    // Validar que la visita sea de tipo Entrada
    const { data: visita, error: getErr } = await supabaseAdmin
      .from('visitas')
      .select('id, tipo, cedula_url, placa_url')
      .eq('id', id)
      .single();

    if (getErr || !visita) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }
    if (visita.tipo !== 'Entrada') {
      return res.status(400).json({ error: 'Solo se puede adjuntar evidencia a visitas de Entrada' });
    }

    const updates = {};
    if (typeof cedula_url === 'string') updates.cedula_url = cedula_url;
    if (typeof placa_url === 'string') updates.placa_url = placa_url;

    const { data, error } = await supabaseAdmin
      .from('visitas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[adjuntarEvidencia] update error:', error, { updates, id });
      return res.status(500).json({ error: 'No se pudo adjuntar la evidencia' });
    }

    return res.json({ message: 'Evidencia adjuntada', data });
  } catch (err) {
    console.error('[adjuntarEvidencia] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { registrarVisita, adjuntarEvidencia };
