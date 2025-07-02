const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const registrarVisita = async (req, res) => {
  const { id_qr, visitante_id } = req.body;

  if (!id_qr || !visitante_id) {
    return res.status(400).json({ error: 'id_qr y visitante_id son obligatorios' });
  }

  try {
    // Verifica si existe una visita con ese id_qr y visitante_id
    const { data: visitaExistente, error: errorExistente } = await supabase
      .from('visitas')
      .select('*')
      .eq('id_qr', id_qr)
      .eq('visitante_id', visitante_id)
      .single();

    if (errorExistente && errorExistente.code !== 'PGRST116') {
      console.error('Error al buscar visita:', errorExistente);
      return res.status(500).json({ error: 'Error al verificar visita' });
    }

    if (!visitaExistente) {
      // Primera vez -> registrar entrada
      const { data, error } = await supabase
        .from('visitas')
        .insert([{
          id_qr,
          visitante_id,
          fecha_entrada: new Date().toISOString(),
        }])
        .select();

      if (error) {
        console.error('Error al registrar entrada:', error);
        return res.status(500).json({ error: 'Error al registrar entrada' });
      }

      return res.json({ message: 'Entrada registrada', data: data[0] });
    } else if (!visitaExistente.fecha_salida) {
      // Ya tiene entrada, ahora registrar salida
      const { data, error } = await supabase
        .from('visitas')
        .update({ fecha_salida: new Date().toISOString() })
        .eq('id', visitaExistente.id)
        .select();

      if (error) {
        console.error('Error al registrar salida:', error);
        return res.status(500).json({ error: 'Error al registrar salida' });
      }

      return res.json({ message: 'Salida registrada', data: data[0] });
    } else {
      return res.status(400).json({ error: 'Este QR ya fue utilizado para entrada y salida' });
    }

  } catch (err) {
    console.error('Error interno:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { registrarVisita };
