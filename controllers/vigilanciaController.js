require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const registrarVisita = async (req, res) => {
  const { id_qr, nombre_residente, numero_casa } = req.body;

  if (!id_qr || !nombre_residente || !numero_casa) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Verifica si ya hay una entrada
  const { data: entradas, error: errorEntrada } = await supabase
    .from('visitas')
    .select('*')
    .eq('id_qr', id_qr)
    .eq('tipo', 'Entrada');

  if (errorEntrada) {
    console.error('Error al consultar visitas:', errorEntrada);
    return res.status(500).json({ error: 'Error al consultar visitas' });
  }

  let tipoVisita = '';

  if (entradas.length === 0) {
    tipoVisita = 'Entrada';
  } else {
    // Verifica si ya hay salida
    const { data: salidas } = await supabase
      .from('visitas')
      .select('*')
      .eq('id_qr', id_qr)
      .eq('tipo', 'Salida');

    if (salidas.length === 0) {
      tipoVisita = 'Salida';
    } else {
      return res.status(400).json({ error: 'La visita ya fue registrada como salida' });
    }
  }

  // Registra la visita
  const { error } = await supabase
    .from('visitas')
    .insert([{
      id_qr,
      nombre_residente,
      numero_casa,
      tipo: tipoVisita,
      fecha_hora: new Date().toISOString()
    }]);

  if (error) {
    console.error('Error al registrar visita:', error);
    return res.status(500).json({ error: 'No se pudo registrar la visita' });
  }

  res.json({ message: `${tipoVisita} registrada correctamente` });
};

module.exports = { registrarVisita };
