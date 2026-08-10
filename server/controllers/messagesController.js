const { supabase } = require('../db/supabase');
const presence = require('../services/presence');
const { membershipOf, touchConversation } = require('../services/conversations');

const PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;
// Правка задним числом сбивает разговор с толку, поэтому окно короткое.
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const MESSAGE_FIELDS =
  'id, conversation_id, sender_id, body, attachment_url, attachment_type, ' +
  'attachment_name, attachment_size, reply_to, edited_at, deleted_at, created_at';

// Удалённое сообщение не отдаётся наружу: остаётся только место в ленте.
function shapeMessage(message, quoted) {
  if (message.deleted_at) {
    return {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      body: '',
      deleted: true,
      created_at: message.created_at,
    };
  }

  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    body: message.body,
    attachment_url: message.attachment_url,
    attachment_type: message.attachment_type,
    attachment_name: message.attachment_name,
    attachment_size: message.attachment_size,
    reply_to: message.reply_to,
    quoted: quoted || null,
    edited_at: message.edited_at,
    deleted: false,
    created_at: message.created_at,
  };
}

// Цитаты подтягиваются одним запросом на страницу, а не по одному на сообщение.
async function quotesFor(messages) {
  const ids = [...new Set(messages.map((m) => m.reply_to).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, attachment_type, attachment_name, deleted_at')
    .in('id', ids);

  if (error) throw error;

  return new Map(
    (data || []).map((m) => [
      m.id,
      {
        id: m.id,
        sender_id: m.sender_id,
        body: m.deleted_at ? 'Сообщение удалено' : m.body,
        attachment_type: m.deleted_at ? null : m.attachment_type,
        attachment_name: m.deleted_at ? null : m.attachment_name,
      },
    ])
  );
}

// GET /api/conversations/:id/messages
// Без параметров — последняя страница. `before` листает вверх по истории,
// `after` забирает только новое: на нём держится вся живая переписка.
async function listMessages(req, res, next) {
  try {
    const membership = await membershipOf(req.params.id, req.user.id);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });

    const limit = Math.min(Number(req.query.limit) || PAGE_SIZE, MAX_PAGE_SIZE);
    const after = req.query.after;

    let query = supabase
      .from('messages')
      .select(MESSAGE_FIELDS)
      .eq('conversation_id', req.params.id);

    if (after) {
      // Новые сообщения читаются по возрастанию: иначе при всплеске переписки
      // limit отрезал бы как раз то, чего вкладка ещё не видела.
      query = query.gt('created_at', after).order('created_at', { ascending: true });
    } else {
      if (req.query.before) query = query.lt('created_at', req.query.before);
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(limit);
    if (error) throw error;

    const rows = after ? data || [] : (data || []).slice().reverse();
    const quotes = await quotesFor(rows);

    // Кто и до какого места дочитал — по этому клиент рисует галочки.
    const { data: readers, error: readersError } = await supabase
      .from('conversation_members')
      .select('user_id, last_read_at')
      .eq('conversation_id', req.params.id);

    if (readersError) throw readersError;

    res.json({
      messages: rows.map((m) => shapeMessage(m, quotes.get(m.reply_to))),
      // Страница полная — значит выше есть ещё история.
      has_more: !after && rows.length === limit,
      readers: readers || [],
      typing: presence.typingIn(req.params.id, req.user.id),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/messages
async function sendMessage(req, res, next) {
  try {
    const membership = await membershipOf(req.params.id, req.user.id);
    if (!membership) return res.status(404).json({ message: 'Разговор не найден' });

    const body = String(req.body.body || '').trim();
    const attachmentUrl = req.body.attachment_url ? String(req.body.attachment_url) : null;

    if (!body && !attachmentUrl) {
      return res.status(400).json({ message: 'Пустое сообщение отправить нельзя' });
    }

    // Ответить можно только на сообщение из этого же разговора: иначе цитата
    // вытащила бы наружу текст чужой переписки.
    let replyTo = null;
    if (req.body.reply_to) {
      const { data: target, error: targetError } = await supabase
        .from('messages')
        .select('id, conversation_id')
        .eq('id', String(req.body.reply_to))
        .maybeSingle();

      if (targetError) throw targetError;
      if (target?.conversation_id === req.params.id) replyTo = target.id;
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: req.params.id,
        sender_id: req.user.id,
        body,
        attachment_url: attachmentUrl,
        attachment_type: attachmentUrl ? String(req.body.attachment_type || 'file') : null,
        attachment_name: req.body.attachment_name ? String(req.body.attachment_name) : null,
        attachment_size: req.body.attachment_size ? Number(req.body.attachment_size) : null,
        reply_to: replyTo,
      })
      .select(MESSAGE_FIELDS)
      .single();

    if (error) throw error;

    await touchConversation(req.params.id, message);

    // Отправка — это и есть прочтение: собственное сообщение не должно
    // возвращаться счётчиком непрочитанных.
    await supabase
      .from('conversation_members')
      .update({ last_read_at: message.created_at })
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id);

    presence.stopTyping(req.params.id, req.user.id);

    const quotes = await quotesFor([message]);
    res.status(201).json({ message: shapeMessage(message, quotes.get(message.reply_to)) });
  } catch (err) {
    next(err);
  }
}

async function loadOwnMessage(id, userId) {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.sender_id !== userId) return null;
  return data;
}

// Подпись разговора хранится отдельно, поэтому после правки или удаления
// последнего сообщения её нужно пересобрать.
async function refreshPreview(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_FIELDS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (data?.length) await touchConversation(conversationId, data[0]);
}

// PATCH /api/messages/:id — правка своего текста.
async function editMessage(req, res, next) {
  try {
    const message = await loadOwnMessage(req.params.id, req.user.id);
    if (!message) return res.status(404).json({ message: 'Сообщение не найдено' });
    if (message.deleted_at) {
      return res.status(400).json({ message: 'Удалённое сообщение не изменить' });
    }
    if (Date.now() - new Date(message.created_at).getTime() > EDIT_WINDOW_MS) {
      return res.status(400).json({ message: 'Изменять можно сообщения не старше суток' });
    }

    const body = String(req.body.body || '').trim();
    if (!body && !message.attachment_url) {
      return res.status(400).json({ message: 'Текст не может быть пустым' });
    }

    const { data: updated, error } = await supabase
      .from('messages')
      .update({ body, edited_at: new Date().toISOString() })
      .eq('id', message.id)
      .select(MESSAGE_FIELDS)
      .single();

    if (error) throw error;

    await refreshPreview(message.conversation_id);

    const quotes = await quotesFor([updated]);
    res.json({ message: shapeMessage(updated, quotes.get(updated.reply_to)) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/messages/:id — мягкое удаление своего сообщения.
async function deleteMessage(req, res, next) {
  try {
    const message = await loadOwnMessage(req.params.id, req.user.id);
    if (!message) return res.status(404).json({ message: 'Сообщение не найдено' });

    const { error } = await supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        body: '',
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        attachment_size: null,
      })
      .eq('id', message.id);

    if (error) throw error;

    await refreshPreview(message.conversation_id);

    res.json({ message: 'Сообщение удалено' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMessages, sendMessage, editMessage, deleteMessage };
