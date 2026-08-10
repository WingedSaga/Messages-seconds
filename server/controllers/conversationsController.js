const { supabase } = require('../db/supabase');
const presence = require('../services/presence');
const {
  MEMBER_FIELDS,
  directKey,
  membershipOf,
  membersOf,
} = require('../services/conversations');

// Потолок разбора непрочитанных за один запрос. Ста сообщений на чат хватает
// с запасом, а счётчик всё равно показывается как «99+».
const UNREAD_SCAN_LIMIT = 1000;
const GROUP_MEMBERS_LIMIT = 100;

function decorateMember(row) {
  const user = row.users || {};
  return {
    id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    role: row.role,
    online: presence.isOnline(user.id),
  };
}

// Собирает разговор в вид, который рисует клиент: имя, аватар и подпись
// у личной переписки берутся у собеседника.
function shapeConversation(conversation, members, meId, unread, lastReadAt) {
  const companion =
    conversation.kind === 'direct' ? members.find((m) => m.id !== meId) || null : null;

  return {
    id: conversation.id,
    kind: conversation.kind,
    title: conversation.kind === 'direct' ? companion?.username || 'Удалённый аккаунт' : conversation.title,
    avatar_url: conversation.kind === 'direct' ? companion?.avatar_url || null : conversation.avatar_url,
    companion,
    members,
    created_by: conversation.created_by,
    last_message_at: conversation.last_message_at,
    last_message_preview: conversation.last_message_preview,
    last_message_sender_id: conversation.last_message_sender_id,
    last_read_at: lastReadAt,
    unread,
  };
}

// GET /api/conversations — весь список одним запросом. Вкладка опрашивает его
// постоянно, поэтому запросов к базе ровно четыре независимо от числа чатов.
async function listConversations(req, res, next) {
  try {
    const meId = req.user.id;

    const { data: myMemberships, error: membershipError } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', meId);

    if (membershipError) throw membershipError;

    const ids = (myMemberships || []).map((m) => m.conversation_id);
    if (!ids.length) return res.json({ conversations: [] });

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .in('id', ids)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    const memberRows = await membersOf(ids);

    // Непрочитанные считаются по одной выборке на все чаты сразу: берём
    // сообщения новее самой старой отметки прочтения и раскладываем их
    // по разговорам уже в памяти.
    const oldestRead = (myMemberships || [])
      .map((m) => m.last_read_at)
      .sort()[0] || '1970-01-01T00:00:00Z';

    const { data: fresh, error: freshError } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, created_at')
      .in('conversation_id', ids)
      .gt('created_at', oldestRead)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(UNREAD_SCAN_LIMIT);

    if (freshError) throw freshError;

    const readAtOf = new Map((myMemberships || []).map((m) => [m.conversation_id, m.last_read_at]));
    const unreadOf = new Map();
    for (const message of fresh || []) {
      if (message.sender_id === meId) continue;
      if (message.created_at <= (readAtOf.get(message.conversation_id) || '')) continue;
      unreadOf.set(message.conversation_id, (unreadOf.get(message.conversation_id) || 0) + 1);
    }

    const byConversation = new Map();
    for (const row of memberRows) {
      if (!byConversation.has(row.conversation_id)) byConversation.set(row.conversation_id, []);
      byConversation.get(row.conversation_id).push(decorateMember(row));
    }

    res.json({
      conversations: (conversations || []).map((conversation) =>
        shapeConversation(
          conversation,
          byConversation.get(conversation.id) || [],
          meId,
          unreadOf.get(conversation.id) || 0,
          readAtOf.get(conversation.id)
        )
      ),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id
async function getConversation(req, res, next) {
  try {
    const membership = await membershipOf(req.params.id, req.user.id);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    const members = (await membersOf([conversation.id])).map(decorateMember);

    res.json({
      conversation: shapeConversation(
        conversation,
        members,
        req.user.id,
        0,
        membership.last_read_at
      ),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/direct — открыть личную переписку.
// Повторный вызов возвращает уже существующий разговор, а не заводит второй.
async function createDirect(req, res, next) {
  try {
    const meId = req.user.id;
    const otherId = String(req.body.user_id);

    if (otherId === meId) {
      return res.status(400).json({ message: 'Нельзя открыть переписку с самим собой' });
    }

    const { data: other, error: otherError } = await supabase
      .from('users')
      .select(MEMBER_FIELDS)
      .eq('id', otherId)
      .maybeSingle();

    if (otherError) throw otherError;
    if (!other) return res.status(404).json({ message: 'Пользователь не найден' });

    const key = directKey(meId, otherId);

    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('id')
      .eq('direct_key', key)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      req.params.id = existing.id;
      return getConversation(req, res, next);
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({ kind: 'direct', created_by: meId, direct_key: key })
      .select('*')
      .single();

    if (error) throw error;

    const { error: membersError } = await supabase.from('conversation_members').insert([
      { conversation_id: conversation.id, user_id: meId, role: 'owner' },
      { conversation_id: conversation.id, user_id: otherId, role: 'member' },
    ]);

    if (membersError) throw membersError;

    req.params.id = conversation.id;
    return getConversation(req, res, next);
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/group
async function createGroup(req, res, next) {
  try {
    const meId = req.user.id;
    const title = String(req.body.title).trim();
    const memberIds = [...new Set((req.body.member_ids || []).map(String))].filter(
      (id) => id !== meId
    );

    if (!memberIds.length) {
      return res.status(400).json({ message: 'Добавьте хотя бы одного участника' });
    }
    if (memberIds.length + 1 > GROUP_MEMBERS_LIMIT) {
      return res.status(400).json({ message: `В группе не больше ${GROUP_MEMBERS_LIMIT} участников` });
    }

    const { data: found, error: foundError } = await supabase
      .from('users')
      .select('id')
      .in('id', memberIds);

    if (foundError) throw foundError;
    if ((found || []).length !== memberIds.length) {
      return res.status(400).json({ message: 'Кого-то из участников больше нет' });
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({ kind: 'group', title, created_by: meId })
      .select('*')
      .single();

    if (error) throw error;

    const rows = [
      { conversation_id: conversation.id, user_id: meId, role: 'owner' },
      ...memberIds.map((id) => ({ conversation_id: conversation.id, user_id: id, role: 'member' })),
    ];

    const { error: membersError } = await supabase.from('conversation_members').insert(rows);
    if (membersError) throw membersError;

    req.params.id = conversation.id;
    return getConversation(req, res, next);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/:id — название и картинка группы, только создателю.
async function updateGroup(req, res, next) {
  try {
    const membership = await membershipOf(req.params.id, req.user.id);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });
    if (membership.role !== 'owner') {
      return res.status(403).json({ message: 'Менять группу может только создатель' });
    }

    const patch = {};
    if (req.body.title !== undefined) patch.title = String(req.body.title).trim();
    if (req.body.avatar_url !== undefined) {
      patch.avatar_url = String(req.body.avatar_url).trim() || null;
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from('conversations')
        .update(patch)
        .eq('id', req.params.id)
        .eq('kind', 'group');

      if (error) throw error;
    }

    return getConversation(req, res, next);
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/members — добавить людей в группу.
async function addMembers(req, res, next) {
  try {
    const membership = await membershipOf(req.params.id, req.user.id);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('kind')
      .eq('id', req.params.id)
      .single();

    if (conversationError) throw conversationError;
    if (conversation.kind !== 'group') {
      return res.status(400).json({ message: 'В личную переписку нельзя добавить участника' });
    }

    const userIds = [...new Set((req.body.user_ids || []).map(String))];
    if (!userIds.length) return res.status(400).json({ message: 'Некого добавлять' });

    const rows = userIds.map((id) => ({
      conversation_id: req.params.id,
      user_id: id,
      role: 'member',
    }));

    // Кто-то уже может быть в группе: повторное добавление не ошибка.
    const { error } = await supabase
      .from('conversation_members')
      .upsert(rows, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true });

    if (error) throw error;

    return getConversation(req, res, next);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/conversations/:id/members/:userId — выйти самому или убрать
// участника. Убирать чужих может только создатель.
async function removeMember(req, res, next) {
  try {
    const meId = req.user.id;
    const targetId = req.params.userId;

    const membership = await membershipOf(req.params.id, meId);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });
    if (targetId !== meId && membership.role !== 'owner') {
      return res.status(403).json({ message: 'Убирать участников может только создатель' });
    }

    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', req.params.id)
      .eq('user_id', targetId);

    if (error) throw error;

    // Разговор без участников больше никому не виден — удаляем вместе
    // с сообщениями, иначе он навсегда осядет в базе.
    const { count, error: countError } = await supabase
      .from('conversation_members')
      .select('user_id', { head: true, count: 'exact' })
      .eq('conversation_id', req.params.id);

    if (countError) throw countError;
    if (!count) {
      const { error: dropError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', req.params.id);
      if (dropError) throw dropError;
    }

    res.json({ message: targetId === meId ? 'Вы вышли из разговора' : 'Участник убран' });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/read — отметка «дочитал до сих пор».
async function markRead(req, res, next) {
  try {
    const membership = await membershipOf(req.params.id, req.user.id);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('conversation_members')
      .update({ last_read_at: readAt })
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ last_read_at: readAt });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/typing — «печатает». Живёт в памяти сервера.
async function setTyping(req, res, next) {
  try {
    const membership = await membershipOf(req.params.id, req.user.id);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });

    if (req.body.stop) presence.stopTyping(req.params.id, req.user.id);
    else presence.setTyping(req.params.id, req.user.id);

    res.json({ message: 'ok' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConversations,
  getConversation,
  createDirect,
  createGroup,
  updateGroup,
  addMembers,
  removeMember,
  markRead,
  setTyping,
};
