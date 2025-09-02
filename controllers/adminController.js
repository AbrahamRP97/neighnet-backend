require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

/**
 * GET /api/admin/residentes?q=texto
 * Devuelve lista de residentes para el selector (id, nombre, numero_casa, correo)
 */
const buscarResidentes = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let query = supabaseAdmin
      .from('usuarios')
      .select('id, nombre, numero_casa, correo, role')
      .eq('role', 'residente')
      .order('nombre', { ascending: true });

    if (q) {
      // Busca por nombre o correo
      query = query.ilike('nombre', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'No se pudieron listar residentes' });
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

    // Valida que el residente exista y sea residente
    const { data: residente, error: resErr } = await supabaseAdmin
      .from('usuarios')
      .select('id, role')
      .eq('id', residente_id)
      .single();

    if (resErr || !residente) return res.status(404).json({ error: 'Residente no encontrado' });
    if (residente.role !== 'residente') return res.status(400).json({ error: 'El usuario no es residente' });

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

    if (error) return res.status(500).json({ error: 'No se pudo crear el visitante' });
    return res.status(201).json(data);
  } catch (err) {
    console.error('[crearVisitanteParaResidente] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

/**
 * GET /api/admin/visitas?from=&to=&estado=(all|pending|complete)&limit=100
 * Devuelve visitas con evidencia y estado (para AdminVisitsScreen)
 */
const listarVisitasAdmin = async (req, res) => {
  try {
    const { from, to, estado = 'all', limit = '100' } = req.query;

    let query = supabaseAdmin
      .from('visitas')
      .select(`
        id, id_qr, visitante_id, guard_id, tipo, fecha_hora, expires_at, cedula_url, placa_url,
        visitante:visitantes(id, nombre, residente_id),
        guard:usuarios!visitas_guard_id_fkey(id, nombre),
        residente:usuarios!visitantes_residente_id_fkey(id, nombre, numero_casa)
      `)
      .order('fecha_hora', { ascending: false })
      .limit(Number(limit) || 100);

    if (from) query = query.gte('fecha_hora', from);
    if (to) query = query.lte('fecha_hora', to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'No se pudieron cargar las visitas' });

    const items = (data || []).map(v => {
      let evidence_status = 'n/a';
      if (v.tipo === 'Entrada') {
        const hasCed = !!v.cedula_url;
        const hasPla = !!v.placa_url;
        if (hasCed && hasPla) evidence_status = 'complete';
        else if (!hasCed && !hasPla) evidence_status = 'pending';
        else evidence_status = !hasCed ? 'missing_cedula' : 'missing_placa';
      }
      return { ...v, evidence_status };
    }).filter(it => {
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
