// Приватные режимы браузера умеют запрещать Web Storage целиком. Хранилище
// не должно мешать открыть переписку: без него вход просто не переживёт
// перезагрузку вкладки.
export function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
