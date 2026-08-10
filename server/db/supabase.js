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

let bucketReady;

// Storage is separate from the SQL schema. Make the required public bucket
// available automatically so a fresh deployment cannot fail with “Bucket not found”.
async function ensureStorageBucket() {
  if (bucketReady) return bucketReady;

  bucketReady = (async () => {
    const { data: existing, error: lookupError } = await supabase.storage.getBucket(STORAGE_BUCKET);
    if (existing) return existing;

    if (lookupError && !/not found/i.test(lookupError.message || '')) throw lookupError;

    const { data: created, error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
    });
    if (createError && !/already exists|duplicate/i.test(createError.message || '')) throw createError;

    return created || { name: STORAGE_BUCKET };
  })();

  try {
    return await bucketReady;
  } catch (error) {
    bucketReady = undefined;
    throw error;
  }
}

module.exports = { supabase, STORAGE_BUCKET, ensureStorageBucket };
