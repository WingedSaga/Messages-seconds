const { supabase } = require('../db/supabase');
const presence = require('../services/presence');
const { state: schema } = require('../db/checkSchema');
const { MEMBER_FIELDS } = require('../services/conversations');

const SEARCH_LIMIT = 20;

// GET /api/users?q= — поиск собеседника по имени.
// Список пользователей целиком наружу не отдаётся: без запроса приходит пусто,
// чтобы адресную книгу сайта нельзя было выгрузить одним обращением.
async function searchUsers(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ users: [] });

    // Экранируем символы, которыми PostgREST разделяет части фильтра, —
    // иначе запятая или скобка в поиске ломают запрос.
    const safe = query.replace(/[,()\\]/g, ' ').trim();
    if (!safe) return res.json({ users: [] });

    const { data, error } = await supabase
      .from('users')
      .select(MEMBER_FIELDS)
      .ilike('username', `%${safe}%`)
      .eq('is_banned', false)
      .neq('id', req.user.id)
      .order('username')
      .limit(SEARCH_LIMIT);

    if (error) throw error;

    res.json({
      users: (data || []).map((user) => ({ ...user, online: presence.isOnline(user.id) })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id — карточка собеседника: имя, аватар, когда был на связи.
async function getUser(req, res, next) {
  try {
    const fields = schema.hasLastSeen ? `${MEMBER_FIELDS}, last_seen_at` : MEMBER_FIELDS;

    const { data: user, error } = await supabase
      .from('users')
      .select(fields)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json({
      user: {
        ...user,
        online: presence.isOnline(user.id),
        // Отметка в памяти свежее записанной в базу: база обновляется раз в пару минут.
        last_seen_at: presence.lastSeen(user.id) || user.last_seen_at || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchUsers, getUser };
