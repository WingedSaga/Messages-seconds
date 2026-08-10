import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../api/axios';
import { readStorage, removeStorage, writeStorage } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Пока токен не проверен, нельзя ни показать переписку, ни увести на вход:
  // иначе при каждом обновлении страницы мелькает форма входа.
  const [loading, setLoading] = useState(Boolean(readStorage(TOKEN_KEY)));

  const applySession = useCallback((token, nextUser) => {
    writeStorage(TOKEN_KEY, token);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    removeStorage(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!readStorage(TOKEN_KEY)) return undefined;

    let cancelled = false;
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) removeStorage(TOKEN_KEY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Просроченный токен ловится в перехватчике axios — оттуда приходит событие.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('ms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ms:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { data } = await api.post('/auth/login', credentials);
      applySession(data.token, data.user);
      return data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload);
      applySession(data.token, data.user);
      return data.user;
    },
    [applySession]
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth вызван вне AuthProvider');
  return context;
}
