require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Registrar visita (entrada/salida)
const registrarVisita = async (req, res) => {
  const { id_qr, visitante_id } = req.body;

  if (!id_qr || !visitante_id) {
    return res.status(400).json({ error: 'id_qr y visitante_id son obligatorios' });
  }

  // Verificar si ya hay entrada
  const { data: ultima } = await supabase
    .from('visitas')
    .select('*')
    .eq('id_qr', id_qr)
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .single();

  let tipo = 'Entrada';
  if (ultima && ultima.tipo === 'Entrada') {
    tipo = 'Salida';
  }

  const { data, error } = await supabase
    .from('visitas')
    .insert([{ id_qr, visitante_id, tipo }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: `${tipo} registrada`, data: data[0] });
};

module.exports = { registrarVisita };
