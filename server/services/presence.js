const { supabase } = require('../db/supabase');
const { state: schema } = require('../db/checkSchema');

// Кто сейчас у экрана и кто печатает. Данные живут в памяти одного процесса:
// сервер запущен в единственном экземпляре, а платить запросом к базе за
// каждое нажатие клавиши бессмысленно.
const online = new Map(); // id пользователя -> отметка времени
const typing = new Map(); // id разговора -> Map(id пользователя -> отметка)

// Человек считается в сети, пока его вкладка опрашивала сервер меньше минуты назад.
const ONLINE_TTL_MS = 60 * 1000;
// «Печатает» гаснет быстро: подпись, висящая после ухода собеседника, обманывает.
const TYPING_TTL_MS = 6 * 1000;
// Как часто отметка визита уходит в базу. Каждый опрос писать в Supabase дорого.
const PERSIST_EVERY_MS = 2 * 60 * 1000;

const persisted = new Map();

function touch(userId) {
  if (!userId) return;
  online.set(userId, Date.now());

  const last = persisted.get(userId) || 0;
  if (!schema.hasLastSeen || Date.now() - last < PERSIST_EVERY_MS) return;

  persisted.set(userId, Date.now());
  supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) console.error('[presence] не удалось сохранить last_seen_at:', error.message);
    });
}

function isOnline(userId) {
  const seen = online.get(userId);
  return Boolean(seen) && Date.now() - seen < ONLINE_TTL_MS;
}

function lastSeen(userId) {
  const seen = online.get(userId);
  return seen ? new Date(seen).toISOString() : null;
}

function setTyping(conversationId, userId) {
  if (!typing.has(conversationId)) typing.set(conversationId, new Map());
  typing.get(conversationId).set(userId, Date.now());
}

function stopTyping(conversationId, userId) {
  typing.get(conversationId)?.delete(userId);
}

// Кто печатает в разговоре, кроме самого спрашивающего.
function typingIn(conversationId, exceptUserId) {
  const room = typing.get(conversationId);
  if (!room) return [];

  const now = Date.now();
  const result = [];
  for (const [userId, stamp] of room) {
    if (now - stamp > TYPING_TTL_MS) room.delete(userId);
    else if (userId !== exceptUserId) result.push(userId);
  }
  if (!room.size) typing.delete(conversationId);
  return result;
}

// Записи ушедших не должны копиться: вкладок за сутки много, память одна.
setInterval(() => {
  const now = Date.now();
  for (const [userId, stamp] of online) {
    if (now - stamp > ONLINE_TTL_MS * 10) {
      online.delete(userId);
      persisted.delete(userId);
    }
  }
}, ONLINE_TTL_MS * 10).unref();

module.exports = { touch, isOnline, lastSeen, setTyping, stopTyping, typingIn };
