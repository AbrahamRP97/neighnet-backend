require('dotenv').config();

// Polyfill WebSocket para entorno Node (Render / Node 20)
globalThis.WebSocket = require('ws');

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Config Supabase incompleta');
}

// Client con Service Role (bypass RLS), solo en backend
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabaseAdmin };