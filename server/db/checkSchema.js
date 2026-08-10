const { supabase } = require('./supabase');

// Таблицы, без которых мессенджер не работает вообще.
const REQUIRED_TABLES = ['users', 'conversations', 'conversation_members', 'messages'];

// Колонка last_seen_at живёт в общей с сайтом таблице users и добавляется
// отдельной строкой schema.sql. PostgREST роняет весь запрос, если попросить
// несуществующую колонку, поэтому её наличие проверяется на старте: отставшая
// база должна стоить одной подписи «был(а) недавно», а не всей переписки.
const state = { hasLastSeen: false };

async function tableMissing(table) {
  const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
  return Boolean(error);
}

async function checkSchema() {
  try {
    const missing = [];
    for (const table of REQUIRED_TABLES) {
      // eslint-disable-next-line no-await-in-loop
      if (await tableMissing(table)) missing.push(table);
    }

    if (missing.length) {
      console.error(
        `[schema] в базе нет таблиц: ${missing.join(', ')}. ` +
          'Выполните server/db/schema.sql в Supabase -> SQL Editor.'
      );
      return;
    }

    const { error } = await supabase.from('users').select('last_seen_at').limit(1);
    state.hasLastSeen = !error;

    if (!state.hasLastSeen) {
      console.warn(
        '[schema] в таблице users нет колонки last_seen_at — время последнего ' +
          'визита не сохраняется. Выполните server/db/schema.sql целиком.'
      );
      return;
    }

    console.log('[schema] структура базы соответствует коду');
  } catch (err) {
    console.error('[schema] не удалось проверить структуру базы:', err.message);
  }
}

module.exports = { checkSchema, state };
