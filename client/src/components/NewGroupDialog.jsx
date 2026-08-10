import { useState } from 'react';
import { X } from 'lucide-react';
import Modal from './Modal';
import UserSearch from './UserSearch';
import Avatar from './Avatar';
import { ErrorNotice } from './Notice';

export default function NewGroupDialog({ meId, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (user) => {
    setChosen((current) =>
      current.some((item) => item.id === user.id)
        ? current.filter((item) => item.id !== user.id)
        : [...current, user]
    );
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      await onCreate(title.trim(), chosen.map((user) => user.id));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Новая группа"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={create}
          disabled={busy || !title.trim() || !chosen.length}
          className="btn-primary w-full"
        >
          Создать группу
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Название</span>
          <input
            value={title}
            maxLength={60}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Семья"
            className="field"
          />
        </label>

        <ErrorNotice message={error} />

        {chosen.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {chosen.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  className="flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pl-1 pr-2.5 text-sm"
                >
                  <Avatar name={user.username} src={user.avatar_url} size="sm" />
                  <span className="max-w-[8rem] truncate">{user.username}</span>
                  <X className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Кого добавить</p>
          <UserSearch
            excludeIds={[meId]}
            selectedIds={chosen.map((user) => user.id)}
            onPick={toggle}
            hint="Найдите участников по имени."
          />
        </div>
      </div>
    </Modal>
  );
}
