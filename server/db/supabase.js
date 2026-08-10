const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_CHAT_BUCKET || 'chat-media';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Не заданы переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY. ' +
      'Скопируйте server/.env.example в server/.env и заполните значения.'
  );
}

// Сервисный клиент: обходит RLS, поэтому используется исключительно на сервере.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabase, STORAGE_BUCKET };
