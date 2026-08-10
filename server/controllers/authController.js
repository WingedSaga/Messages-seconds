const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabase');
const { USER_FIELDS } = require('../middleware/authMiddleware');
const messengerSettings = require('../services/messengerSettings');

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

// POST /api/auth/register — регистрация. Аккаунт общий с сайтом, поэтому
// требования к имени и паролю те же, что и там.
async function register(req, res, next) {
  try {
    const username = String(req.body.username).trim();
    const email = String(req.body.email).trim().toLowerCase();

    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id, email, username')
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(1);

    if (existingError) throw existingError;

    if (existing?.length) {
      const taken = existing[0].email === email ? 'Этот email уже занят' : 'Это имя уже занято';
      return res.status(409).json({ message: taken });
    }

    const password_hash = await bcrypt.hash(String(req.body.password), SALT_ROUNDS);

    const { data: user, error } = await supabase
      .from('users')
      .insert({ username, email, password_hash })
      .select(USER_FIELDS)
      .single();

    if (error) throw error;

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const email = String(req.body.email).trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .select(`${USER_FIELDS}, password_hash`)
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    // Ответ одинаковый и для незнакомого адреса, и для неверного пароля:
    // иначе форма входа превращается в проверку, есть ли такой аккаунт.
    const ok = user && (await bcrypt.compare(String(req.body.password), user.password_hash));
    if (!ok) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    if (user.is_banned) {
      return res.status(403).json({ message: 'Ваш аккаунт заблокирован' });
    }

    if (user.role !== 'admin' && !(await messengerSettings.isLoginOpen())) {
      return res.status(403).json({ message: 'Вход в мессенджер временно доступен только администраторам' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me — проверка живого токена при запуске приложения.
async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

// PATCH /api/auth/profile — имя и аватар. Меняются и на сайте: запись одна.
async function updateProfile(req, res, next) {
  try {
    const patch = {};

    if (req.body.username !== undefined) {
      const username = String(req.body.username).trim();

      const { data: taken, error: takenError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', req.user.id)
        .limit(1);

      if (takenError) throw takenError;
      if (taken?.length) return res.status(409).json({ message: 'Это имя уже занято' });

      patch.username = username;
    }

    if (req.body.avatar_url !== undefined) {
      patch.avatar_url = String(req.body.avatar_url).trim() || null;
    }

    if (!Object.keys(patch).length) {
      return res.json({ user: publicUser(req.user) });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', req.user.id)
      .select(USER_FIELDS)
      .single();

    if (error) throw error;

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/auth/password
async function changePassword(req, res, next) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    const ok = await bcrypt.compare(String(req.body.current_password), user.password_hash);
    if (!ok) return res.status(400).json({ message: 'Текущий пароль указан неверно' });

    const password_hash = await bcrypt.hash(String(req.body.password), SALT_ROUNDS);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    res.json({ message: 'Пароль изменён' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, updateProfile, changePassword, publicUser };
