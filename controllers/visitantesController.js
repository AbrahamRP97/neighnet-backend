require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const listarVisitantes = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { data, error } = await supabase
      .from('visitantes')
      .select('*')
      .eq('residente_id', userId)
      .order('id', { ascending: false });

    if (error) return res.status(500).json({ error: 'No se pudieron cargar los visitantes' });
    return res.json(data || []);
  } catch (err) {
    console.error('[listarVisitantes] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crearVisitante = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const {
      nombre,
      identidad,
      placa,
      marca_vehiculo,
      modelo_vehiculo,
      color_vehiculo,
    } = req.body;

    if (!nombre || !identidad || !placa || !marca_vehiculo || !modelo_vehiculo || !color_vehiculo) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const insertPayload = {
      residente_id: userId,
      nombre,
      identidad,
      placa,
      marca_vehiculo,
      modelo_vehiculo,
      color_vehiculo,
    };

    const { data, error } = await supabase
      .from('visitantes')
      .insert([insertPayload])
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'No se pudo crear el visitante' });
    return res.status(201).json(data);
  } catch (err) {
    console.error('[crearVisitante] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizarVisitante = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { data: existing, error: getErr } = await supabase
      .from('visitantes')
      .select('id, residente_id')
      .eq('id', id)
      .single();

    if (getErr || !existing) {
      return res.status(404).json({ error: 'Visitante no encontrado' });
    }
    if (existing.residente_id !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const {
      nombre,
      identidad,
      placa,
      marca_vehiculo,
      modelo_vehiculo,
      color_vehiculo,
      // ignoramos cualquier residente_id entrante
    } = req.body;

    const updates = {};
    if (typeof nombre === 'string') updates.nombre = nombre;
    if (typeof identidad === 'string') updates.identidad = identidad;
    if (typeof placa === 'string') updates.placa = placa;
    if (typeof marca_vehiculo === 'string') updates.marca_vehiculo = marca_vehiculo;
    if (typeof modelo_vehiculo === 'string') updates.modelo_vehiculo = modelo_vehiculo;
    if (typeof color_vehiculo === 'string') updates.color_vehiculo = color_vehiculo;

    const { data, error } = await supabase
      .from('visitantes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'No se pudo actualizar el visitante' });
    return res.json(data);
  } catch (err) {
    console.error('[actualizarVisitante] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarVisitante = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { data: existing, error: getErr } = await supabase
      .from('visitantes')
      .select('id, residente_id')
      .eq('id', id)
      .single();

    if (getErr || !existing) {
      return res.status(404).json({ error: 'Visitante no encontrado' });
    }
    if (existing.residente_id !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { error } = await supabase
      .from('visitantes')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: 'No se pudo eliminar el visitante' });
    return res.json({ message: 'Visitante eliminado' });
  } catch (err) {
    console.error('[eliminarVisitante] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  listarVisitantes,
  crearVisitante,
  actualizarVisitante,
  eliminarVisitante,
};
