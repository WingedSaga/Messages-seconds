const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabase');
const presence = require('../services/presence');

// Набор полей общей с сайтом таблицы users. Пароль и токены подтверждения
// почты сюда не попадают — мессенджеру они не нужны.
const USER_FIELDS = 'id, username, email, role, avatar_url, is_banned, created_at';

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function loadUserFromToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const { data, error } = await supabase
    .from('users')
    .select(USER_FIELDS)
    .eq('id', payload.sub)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Требует валидный JWT. Токен выпускает и сайт, и мессенджер: секрет общий,
// поэтому вошедший на сайте попадает в переписку без второго входа.
async function authMiddleware(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  try {
    const user = await loadUserFromToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    if (user.is_banned) {
      return res.status(403).json({ message: 'Ваш аккаунт заблокирован' });
    }

    req.user = user;
    // Любой запрос от вкладки — признак присутствия у экрана.
    presence.touch(user.id);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Срок действия сессии истёк' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Недействительный токен' });
    }
    next(err);
  }
}

module.exports = { authMiddleware, USER_FIELDS };
