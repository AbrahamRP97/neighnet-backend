require('dotenv').config();
const { supabaseAdmin } = require('../supabaseClient');

const evidenceStatus = (row) => {
  const hasCed = !!row.cedula_url;
  const hasPl = !!row.placa_url;
  if (row.tipo !== 'Entrada') return 'n/a';
  if (hasCed && hasPl) return 'complete';
  if (hasCed && !hasPl) return 'missing_placa';
  if (!hasCed && hasPl) return 'missing_cedula';
  return 'pending';
};

// GET /api/admin/visitas?from=YYYY-MM-DD&to=YYYY-MM-DD&estado=pending|complete|all&limit=50&offset=0
const listVisitsAdmin = async (req, res) => {
  try {
    const {
      from,
      to,
      estado = 'all',
      limit = 50,
      offset = 0,
      order = 'desc',
    } = req.query;

    let q = supabaseAdmin
      .from('visitas')
      .select('id, id_qr, visitante_id, guard_id, tipo, fecha_hora, expires_at, cedula_url, placa_url', { count: 'exact' });

    if (from) q = q.gte('fecha_hora', new Date(from).toISOString());
    if (to)   q = q.lte('fecha_hora', new Date(to).toISOString());

    q = q.order('fecha_hora', { ascending: order === 'asc' }).range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data: rows, error, count } = await q;
    if (error) {
      console.error('[listVisitsAdmin] query error:', error);
      return res.status(500).json({ error: 'No se pudieron cargar las visitas' });
    }

    // Ids para joins manuales
    const visitanteIds = [...new Set((rows || []).map(r => r.visitante_id).filter(Boolean))];
    const guardIds     = [...new Set((rows || []).map(r => r.guard_id).filter(Boolean))];

    // Cargar visitantes (trae residente_id para luego traer al residente)
    let residentesIds = [];
    let visitantesMap = {};
    if (visitanteIds.length) {
      const { data: visitantes, error: vErr } = await supabaseAdmin
        .from('visitantes')
        .select('id, nombre, residente_id')
        .in('id', visitanteIds);

      if (vErr) {
        console.error('[listVisitsAdmin] visitantes error:', vErr);
      } else {
        visitantesMap = Object.fromEntries((visitantes || []).map(v => [String(v.id), v]));
        residentesIds = [...new Set((visitantes || []).map(v => v.residente_id).filter(Boolean))];
      }
    }

    // Cargar guardias (usuarios)
    let guardsMap = {};
    if (guardIds.length) {
      const { data: guards, error: gErr } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre')
        .in('id', guardIds);

      if (gErr) console.error('[listVisitsAdmin] guards error:', gErr);
      else guardsMap = Object.fromEntries((guards || []).map(u => [String(u.id), u]));
    }

    // Cargar residentes (usuarios)
    let residentesMap = {};
    if (residentesIds.length) {
      const { data: residentes, error: rErr } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre, numero_casa')
        .in('id', residentesIds);

      if (rErr) console.error('[listVisitsAdmin] residentes error:', rErr);
      else residentesMap = Object.fromEntries((residentes || []).map(u => [String(u.id), u]));
    }

    // Componer respuesta + filtrar por estado de evidencia si aplica
    let items = (rows || []).map(row => {
      const visitante = visitantesMap[String(row.visitante_id)] || null;
      const residente = visitante ? (residentesMap[String(visitante.residente_id)] || null) : null;
      const guard     = row.guard_id ? (guardsMap[String(row.guard_id)] || null) : null;

      const evStatus  = evidenceStatus(row);

      return {
        ...row,
        evidence_status: evStatus,
        visitante: visitante ? { id: visitante.id, nombre: visitante.nombre } : null,
        residente: residente ? { id: residente.id, nombre: residente.nombre, numero_casa: residente.numero_casa } : null,
        guard:     guard ? { id: guard.id, nombre: guard.nombre } : null,
      };
    });

    if (estado === 'pending') {
      items = items.filter(i => i.tipo === 'Entrada' && (i.evidence_status === 'pending' || i.evidence_status === 'missing_cedula' || i.evidence_status === 'missing_placa'));
    } else if (estado === 'complete') {
      items = items.filter(i => i.tipo === 'Entrada' && i.evidence_status === 'complete');
    }

    return res.json({
      total: count ?? items.length,
      items,
    });
  } catch (err) {
    console.error('[listVisitsAdmin] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listVisitsAdmin };
