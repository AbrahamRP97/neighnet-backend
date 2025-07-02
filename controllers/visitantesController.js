require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Crear un visitante
const crearVisitante = async (req, res) => {
  const { residente_id, nombre, identidad, color_vehiculo, marca_vehiculo, modelo_vehiculo, placa } = req.body;

  if (!residente_id || !nombre || !identidad) {
    return res.status(400).json({ error: 'Residente, nombre e identidad son obligatorios' });
  }

  const { data, error } = await supabase
    .from('visitantes')
    .insert([{ residente_id, nombre, identidad, color_vehiculo, marca_vehiculo, modelo_vehiculo, placa }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
};

// Listar visitantes de un residente
const listarVisitantes = async (req, res) => {
  const { residente_id } = req.params;

  const { data, error } = await supabase
    .from('visitantes')
    .select('*')
    .eq('residente_id', residente_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// Actualizar visitante
const actualizarVisitante = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from('visitantes')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
};

// Eliminar visitante
const eliminarVisitante = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('visitantes')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Visitante eliminado' });
};

module.exports = {
  crearVisitante,
  listarVisitantes,
  actualizarVisitante,
  eliminarVisitante
};
