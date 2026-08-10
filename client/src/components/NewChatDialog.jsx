import { useState } from 'react';
import Modal from './Modal';
import UserSearch from './UserSearch';
import { ErrorNotice } from './Notice';

// Новый личный чат: находим человека по имени и открываем переписку.
// Повторное открытие того же собеседника не заводит второй чат — сервер
// возвращает уже существующий.
export default function NewChatDialog({ meId, onClose, onOpenDirect }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async (user) => {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      await onOpenDirect(user.id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Новый чат" onClose={onClose}>
      <div className="space-y-3">
        <ErrorNotice message={error} />
        <UserSearch
          excludeIds={[meId]}
          onPick={pick}
          hint="Введите хотя бы две буквы имени. Люди здесь те же, что на сайте «НОВОСТИ СЕКУНДЫ»."
        />
      </div>
    </Modal>
  );
}
