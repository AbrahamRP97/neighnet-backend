const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const registrarVisita = async (req, res) => {
  const { id_qr } = req.body;

  // Aquí, el visitante_id ya NO es requerido; solo el código QR (si así funciona tu app)
  if (!id_qr) {
    return res.status(400).json({ error: 'id_qr es obligatorio' });
  }

  try {
    // Buscar todas las visitas con ese id_qr
    const { data: visitas, error } = await supabase
      .from('visitas')
      .select('*')
      .eq('id_qr', id_qr);

    if (error) {
      return res.status(500).json({ error: 'Error al verificar visita' });
    }

    // Primera vez: entrada
    if (!visitas || visitas.length === 0) {
      const { data, error } = await supabase
        .from('visitas')
        .insert([{ id_qr, fecha_entrada: new Date().toISOString() }])
        .select();
      if (error) return res.status(500).json({ error: 'Error al registrar entrada' });
      return res.json({ message: 'Entrada registrada', data: data[0] });
    }

    // Segunda vez: salida (si la última no tiene fecha_salida)
    if (visitas.length === 1 && !visitas[0].fecha_salida) {
      const { data, error } = await supabase
        .from('visitas')
        .update({ fecha_salida: new Date().toISOString() })
        .eq('id', visitas[0].id)
        .select();
      if (error) return res.status(500).json({ error: 'Error al registrar salida' });
      return res.json({ message: 'Salida registrada', data: data[0] });
    }

    // Tercera vez o más: no permitir
    return res.status(400).json({ error: 'Este QR ya fue utilizado para entrada y salida' });
  } catch (err) {
    console.error('Error interno:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { registrarVisita };