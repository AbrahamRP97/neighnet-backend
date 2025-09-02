require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

/**
 * GET /api/admin/residentes?q=texto
 * Respuesta: { items: [{ id, nombre, numero_casa, correo }] }
 */
const buscarResidentes = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    let query = supabaseAdmin
      .from('usuarios')
      .select('id, nombre, numero_casa, correo, rol')
      .eq('rol', 'residente')
      .order('nombre', { ascending: true })
      .limit(100);

    if (q) {
      const isNum = /^\d+$/.test(q);
      const orFilter = isNum
        ? `nombre.ilike.%${q}%,correo.ilike.%${q}%,numero_casa.eq.${q}`
        : `nombre.ilike.%${q}%,correo.ilike.%${q}%`;
      query = query.or(orFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[buscarResidentes] supabase error:', error);
      return res.status(500).json({ error: 'No se pudieron listar residentes' });
    }
    return res.json({ items: data || [] });
  } catch (err) {
    console.error('[buscarResidentes] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

/**
 * POST /api/admin/visitantes
 * Body: { residente_id, nombre, identidad, placa, marca_vehiculo, modelo_vehiculo, color_vehiculo }
 */
const crearVisitanteParaResidente = async (req, res) => {
  try {
    const {
      residente_id,
      nombre,
      identidad,
      placa,
      marca_vehiculo,
      modelo_vehiculo,
      color_vehiculo,
    } = req.body || {};

    if (!residente_id || !nombre || !identidad || !placa || !marca_vehiculo || !modelo_vehiculo || !color_vehiculo) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Valida que el residente exista y tenga rol 'residente'
    const { data: residente, error: resErr } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol')
      .eq('id', residente_id)
      .single();

    if (resErr || !residente) return res.status(404).json({ error: 'Residente no encontrado' });
    if (residente.rol !== 'residente') return res.status(400).json({ error: 'El usuario no es residente' });

    const payload = {
      residente_id,
      nombre,
      identidad,
      placa,
      marca_vehiculo,
      modelo_vehiculo,
      color_vehiculo,
    };

    const { data, error } = await supabaseAdmin
      .from('visitantes')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[crearVisitanteParaResidente] supabase error:', error);
      return res.status(500).json({ error: 'No se pudo crear el visitante' });
    }
    return res.status(201).json(data);
  } catch (err) {
    console.error('[crearVisitanteParaResidente] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

/**
 * GET /api/admin/visitas?from=&to=&estado=(all|pending|complete)&limit=100
 * Respuesta: { items: [...] }
 */
const listarVisitasAdmin = async (req, res) => {
  try {
    const { from, to, estado = 'all', limit = '100' } = req.query;

    // ✅ Hacemos el join del residente DENTRO de visitante (donde vive la FK)
    const { data, error } = await supabaseAdmin
      .from('visitas')
      .select(`
        id, id_qr, visitante_id, guard_id, tipo, fecha_hora, expires_at, cedula_url, placa_url,
        visitante:visitantes (
          id, nombre, residente_id,
          residente:usuarios!visitantes_residente_id_fkey (
            id, nombre, numero_casa
          )
        ),
        guard:usuarios!visitas_guard_id_fkey (
          id, nombre
        )
      `)
      .order('fecha_hora', { ascending: false })
      .gte(from ? 'fecha_hora' : 'id', from || 0) // gte/lte solo si vienen
      .lte(to ? 'fecha_hora' : 'id', to || Number.MAX_SAFE_INTEGER)
      .limit(Number(limit) || 100);

    if (error) {
      console.error('[listarVisitasAdmin] supabase error:', error);
      return res.status(500).json({ error: 'No se pudieron cargar las visitas' });
    }

    // Aplastamos visitante.residente -> residente (para el frontend)
    const items = (data || [])
      .map(v => {
        const residente = v?.visitante?.residente || null;

        let evidence_status = 'n/a';
        if (v.tipo === 'Entrada') {
          const hasCed = !!v.cedula_url;
          const hasPla = !!v.placa_url;
          if (hasCed && hasPla) evidence_status = 'complete';
          else if (!hasCed && !hasPla) evidence_status = 'pending';
          else evidence_status = !hasCed ? 'missing_cedula' : 'missing_placa';
        }

        return { ...v, residente, evidence_status };
      })
      .filter(it => {
        if (estado === 'all') return true;
        if (estado === 'complete') return it.evidence_status === 'complete';
        if (estado === 'pending') return it.evidence_status !== 'complete';
        return true;
      });

    return res.json({ items });
  } catch (err) {
    console.error('[listarVisitasAdmin] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

module.exports = { buscarResidentes, crearVisitanteParaResidente, listarVisitasAdmin };
