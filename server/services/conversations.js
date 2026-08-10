const { supabase } = require('../db/supabase');

// Поля собеседника, которые видит другая сторона. Почта в переписку не уходит:
// имени и аватара достаточно, а адрес — личные данные.
const MEMBER_FIELDS = 'id, username, avatar_url';

// Ключ личной переписки: два идентификатора по алфавиту через двоеточие.
// Пара всегда даёт одну и ту же строку, а уникальный индекс не даёт завести
// второй диалог с тем же человеком при двойном нажатии.
function directKey(a, b) {
  return [a, b].sort().join(':');
}

// Короткая подпись для списка чатов.
function previewOf(message) {
  if (message.deleted_at) return 'Сообщение удалено';
  if (message.body) return message.body.slice(0, 120);
  if (message.attachment_type === 'image') return 'Фотография';
  if (message.attachment_type === 'file') return message.attachment_name || 'Файл';
  return '';
}

// Участие в разговоре — единственная проверка доступа: чужую переписку
// нельзя ни прочитать, ни дополнить.
async function membershipOf(conversationId, userId) {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id, role, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function membersOf(conversationIds) {
  if (!conversationIds.length) return [];

  const { data, error } = await supabase
    .from('conversation_members')
    .select(`conversation_id, user_id, role, users:user_id (${MEMBER_FIELDS})`)
    .in('conversation_id', conversationIds);

  if (error) throw error;
  return data || [];
}

// Обновляет подпись разговора после нового или изменённого сообщения.
async function touchConversation(conversationId, message) {
  const { error } = await supabase
    .from('conversations')
    .update({
      last_message_at: message.created_at,
      last_message_preview: previewOf(message),
      last_message_sender_id: message.sender_id,
    })
    .eq('id', conversationId);

  if (error) throw error;
}

module.exports = { MEMBER_FIELDS, directKey, previewOf, membershipOf, membersOf, touchConversation };
