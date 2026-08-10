import { useEffect, useState } from 'react';
import { LogOut, Pencil, UserMinus, UserPlus } from 'lucide-react';
import api from '../api/axios';
import Modal from './Modal';
import Avatar from './Avatar';
import UserSearch from './UserSearch';
import { ErrorNotice } from './Notice';
import { formatLastSeen, plural } from '../utils/format';

// Сведения о разговоре: участники, переименование группы, выход.
export default function ConversationInfo({ conversation, meId, onClose, onChanged, onLeft }) {
  const [title, setTitle] = useState(conversation.title);
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isGroup = conversation.kind === 'group';
  const iAmOwner = conversation.members.find((m) => m.id === meId)?.role === 'owner';

  // «Был(а) недавно» в списке чатов не нужно, поэтому список его и не отдаёт:
  // подтягиваем только когда карточку собеседника действительно открыли.
  const [companion, setCompanion] = useState(conversation.companion);
  useEffect(() => {
    if (isGroup || !conversation.companion?.id) return;
    api
      .get(`/users/${conversation.companion.id}`)
      .then(({ data }) => setCompanion(data.user))
      .catch(() => {});
  }, [isGroup, conversation.companion?.id]);

  const run = async (action) => {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rename = () =>
    run(async () => {
      await api.patch(`/conversations/${conversation.id}`, { title: title.trim() });
      setRenaming(false);
      await onChanged();
    });

  const addMembers = (user) =>
    run(async () => {
      await api.post(`/conversations/${conversation.id}/members`, { user_ids: [user.id] });
      await onChanged();
    });

  const removeMember = (userId) =>
    run(async () => {
      await api.delete(`/conversations/${conversation.id}/members/${userId}`);
      if (userId === meId) {
        onLeft();
        onClose();
      } else {
        await onChanged();
      }
    });

  return (
    <Modal title={isGroup ? 'О группе' : 'О собеседнике'} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar
            name={conversation.title}
            src={conversation.avatar_url}
            size="lg"
            group={isGroup}
            online={companion?.online}
          />
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-bold text-ink">{conversation.title}</p>
            <p className="text-sm text-muted">
              {isGroup
                ? plural(conversation.members.length, 'участник', 'участника', 'участников')
                : companion?.online
                  ? 'в сети'
                  : formatLastSeen(companion?.last_seen_at)}
            </p>
          </div>
        </div>

        <ErrorNotice message={error} />

        {isGroup && iAmOwner && (
          <div>
            {renaming ? (
              <div className="flex gap-2">
                <input
                  value={title}
                  maxLength={60}
                  onChange={(event) => setTitle(event.target.value)}
                  className="field"
                  aria-label="Название группы"
                />
                <button type="button" onClick={rename} disabled={busy} className="btn-primary">
                  Сохранить
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setRenaming(true)} className="btn-outline w-full">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Переименовать группу
              </button>
            )}
          </div>
        )}

        {isGroup && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Участники</p>
              <button
                type="button"
                onClick={() => setAdding((open) => !open)}
                className="btn-ghost text-xs"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" /> Добавить
              </button>
            </div>

            {adding && (
              <div className="mb-3 rounded-2xl border border-line p-3">
                <UserSearch
                  excludeIds={conversation.members.map((m) => m.id)}
                  onPick={addMembers}
                  hint="Найдите человека по имени."
                />
              </div>
            )}

            <ul className="space-y-1">
              {conversation.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <Avatar
                    name={member.username}
                    src={member.avatar_url}
                    size="sm"
                    online={member.online}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">
                      {member.username}
                      {member.id === meId && ' (вы)'}
                    </span>
                    {member.role === 'owner' && (
                      <span className="block text-[11px] text-muted">создатель</span>
                    )}
                  </span>

                  {iAmOwner && member.id !== meId && (
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      disabled={busy}
                      className="icon-btn h-8 w-8 text-red-600 hover:bg-red-50"
                      aria-label={`Убрать ${member.username}`}
                    >
                      <UserMinus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => removeMember(meId)}
          disabled={busy}
          className="btn w-full border border-red-300 text-red-700 hover:bg-red-600 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {isGroup ? 'Выйти из группы' : 'Удалить переписку у себя'}
        </button>
      </div>
    </Modal>
  );
}
