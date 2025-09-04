require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

/**
 * GET /api/admin/residentes?q=texto
 * Devuelve lista de residentes para el selector (id, nombre, numero_casa, correo)
 */
const buscarResidentes = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    // ✅ usar columna correcta: "rol" (no "role")
    let query = supabaseAdmin
      .from('usuarios')
      .select('id, nombre, numero_casa, correo, rol')
      .eq('rol', 'residente')
      .order('nombre', { ascending: true });

    if (q) {
      // búsqueda por nombre/correo/casa
      // si numero_casa fuera numérica, podrías quitarla de este OR
      query = query.or(`nombre.ilike.%${q}%,correo.ilike.%${q}%,numero_casa.ilike.%${q}%`);
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

    // Validar residente
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

    if (error) return res.status(500).json({ error: 'No se pudo crear el visitante' });
    return res.status(201).json(data);
  } catch (err) {
    console.error('[crearVisitanteParaResidente] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

/**
 * GET /api/admin/visitas?from=&to=&estado=(all|pending|complete)&limit=100
 */
const listarVisitasAdmin = async (req, res) => {
  try {
    const { from, to, estado = 'all', limit = '100' } = req.query;
    const max = Number(limit) || 100;

    // 1) Traer visitas "planas"
    let vQuery = supabaseAdmin
      .from('visitas')
      .select('id, id_qr, visitante_id, guard_id, tipo, fecha_hora, expires_at, cedula_url, placa_url')
      .order('fecha_hora', { ascending: false })
      .limit(max);

    if (from) vQuery = vQuery.gte('fecha_hora', from);
    if (to) vQuery = vQuery.lte('fecha_hora', to);

    const { data: visitas, error: eVis } = await vQuery;
    if (eVis) {
      console.error('[listarVisitasAdmin] visitas error:', eVis);
      return res.status(500).json({ error: 'No se pudieron cargar las visitas' });
    }

    if (!visitas || visitas.length === 0) {
      return res.json({ items: [] });
    }

    // 2) Traer visitantes vinculados
    const visitanteIds = [...new Set(visitas.map(v => v.visitante_id).filter(Boolean))];
    let visitantes = [];
    if (visitanteIds.length) {
      const { data, error } = await supabaseAdmin
        .from('visitantes')
        .select('id, nombre, residente_id')
        .in('id', visitanteIds);
      if (error) {
        console.error('[listarVisitasAdmin] visitantes error:', error);
        return res.status(500).json({ error: 'No se pudieron cargar las visitas' });
      }
      visitantes = data || [];
    }

    // 3) Traer residentes y guards (usuarios)
    const residenteIds = [...new Set(visitantes.map(v => v.residente_id).filter(Boolean))];
    const guardIds = [...new Set(visitas.map(v => v.guard_id).filter(Boolean))];

    let residentes = [];
    if (residenteIds.length) {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre, numero_casa')
        .in('id', residenteIds);
      if (error) {
        console.error('[listarVisitasAdmin] residentes error:', error);
        return res.status(500).json({ error: 'No se pudieron cargar las visitas' });
      }
      residentes = data || [];
    }

    let guards = [];
    if (guardIds.length) {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre')
        .in('id', guardIds);
      if (error) {
        console.error('[listarVisitasAdmin] guards error:', error);
        return res.status(500).json({ error: 'No se pudieron cargar las visitas' });
      }
      guards = data || [];
    }

    // 4) Indexar y ensamblar respuesta
    const byVisitante = Object.fromEntries(visitantes.map(v => [v.id, v]));
    const byResidente = Object.fromEntries(residentes.map(u => [u.id, u]));
    const byGuard = Object.fromEntries(guards.map(u => [u.id, u]));

    const items = (visitas || [])
      .map(v => {
        // estado de evidencia
        let evidence_status = 'n/a';
        if (v.tipo === 'Entrada') {
          const hasCed = !!v.cedula_url;
          const hasPla = !!v.placa_url;
          if (hasCed && hasPla) evidence_status = 'complete';
          else if (!hasCed && !hasPla) evidence_status = 'pending';
          else evidence_status = !hasCed ? 'missing_cedula' : 'missing_placa';
        }

        const visitanteRaw = byVisitante[v.visitante_id];
        const visitante = visitanteRaw ? { id: visitanteRaw.id, nombre: visitanteRaw.nombre } : null;

        let residente = null;
        if (visitanteRaw?.residente_id) {
          const r = byResidente[visitanteRaw.residente_id];
          if (r) {
            residente = { id: r.id, nombre: r.nombre, numero_casa: r.numero_casa ?? null };
          }
        }

        const guard = v.guard_id && byGuard[v.guard_id]
          ? { id: v.guard_id, nombre: byGuard[v.guard_id].nombre }
          : null;

        return {
          id: v.id,
          id_qr: v.id_qr,
          visitante_id: v.visitante_id,
          guard_id: v.guard_id ?? null,
          tipo: v.tipo,
          fecha_hora: v.fecha_hora,
          expires_at: v.expires_at ?? null,
          cedula_url: v.cedula_url ?? null,
          placa_url: v.placa_url ?? null,
          evidence_status,
          visitante,
          residente,
          guard,
        };
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
