const { supabase } = require('../db/supabase');

const LOGIN_KEY = 'messages_login_open';

async function isLoginOpen() {
  const { data, error } = await supabase.from('settings').select('value').eq('key', LOGIN_KEY).maybeSingle();
  if (error) throw error;
  // До первого изменения в админ-панели вход остаётся открытым.
  return data?.value !== false;
}

async function setLoginOpen(loginOpen) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: LOGIN_KEY, value: Boolean(loginOpen) }, { onConflict: 'key' });
  if (error) throw error;
  return Boolean(loginOpen);
}

module.exports = { isLoginOpen, setLoginOpen };
