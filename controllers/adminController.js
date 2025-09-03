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

    // ✅ usar aliases de FK estándar:
    // - visitas.visitante_id -> visitantes.id => visitas_visitante_id_fkey
    // - visitantes.residente_id -> usuarios.id => visitantes_residente_id_fkey
    // - visitas.guard_id -> usuarios.id => visitas_guard_id_fkey
    let query = supabaseAdmin
      .from('visitas')
      .select(`
        id,
        id_qr,
        visitante_id,
        guard_id,
        tipo,
        fecha_hora,
        expires_at,
        cedula_url,
        placa_url,
        visitante:visitantes!visitas_visitante_id_fkey (
          id,
          nombre,
          residente:usuarios!visitantes_residente_id_fkey (
            id,
            nombre,
            numero_casa
          )
        ),
        guard:usuarios!visitas_guard_id_fkey (
          id,
          nombre
        )
      `)
      .order('fecha_hora', { ascending: false })
      .limit(Number(limit) || 100);

    if (from) query = query.gte('fecha_hora', from);
    if (to) query = query.lte('fecha_hora', to);

    const { data, error } = await query;

    if (error) {
      console.error('[listarVisitasAdmin] supabase error:', error);
      return res.status(500).json({ error: 'No se pudieron cargar las visitas' });
    }

    const items = (data || [])
      .map(v => {
        let evidence_status = 'n/a';
        if (v.tipo === 'Entrada') {
          const hasCed = !!v.cedula_url;
          const hasPla = !!v.placa_url;
          if (hasCed && hasPla) evidence_status = 'complete';
          else if (!hasCed && !hasPla) evidence_status = 'pending';
          else evidence_status = !hasCed ? 'missing_cedula' : 'missing_placa';
        }

        const visitante = v.visitante ? { id: v.visitante.id, nombre: v.visitante.nombre } : null;
        const residente =
          v.visitante?.residente
            ? {
                id: v.visitante.residente.id,
                nombre: v.visitante.residente.nombre,
                numero_casa: v.visitante.residente.numero_casa ?? null,
              }
            : null;

        const guard = v.guard ? { id: v.guard.id, nombre: v.guard.nombre } : null;

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
