import { useEffect, useRef } from 'react';

// Обновление без веб-сокетов: вкладка сама спрашивает сервер.
// Сокеты на Raspberry Pi за туннелем рвутся при каждом переподключении,
// а короткий опрос переживает и обрыв сети, и сон телефона.
//
// Когда вкладка скрыта, интервал растягивается: фоновая переписка не стоит
// того, чтобы будить сервер и жечь батарею.
export default function usePolling(callback, { interval, hiddenInterval = interval * 6, enabled = true }) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;

    let timer = null;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        await saved.current();
      } catch {
        // Обрыв связи не должен останавливать опрос: следующая попытка
        // случится по расписанию и, скорее всего, пройдёт.
      }
      if (stopped) return;
      timer = setTimeout(tick, document.hidden ? hiddenInterval : interval);
    };

    // Возврат к вкладке — самый частый момент, когда данные устарели.
    const onVisible = () => {
      if (document.hidden || stopped) return;
      clearTimeout(timer);
      tick();
    };

    tick();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [interval, hiddenInterval, enabled]);
}
