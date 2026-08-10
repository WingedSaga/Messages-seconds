import axios from 'axios';
import { readStorage, removeStorage } from '../utils/storage';

// Ключ намеренно тот же, что у сайта «НОВОСТИ СЕКУНДЫ». Когда мессенджер
// переедет на тот же домен, вход на сайте станет входом в переписку:
// токен один, секрет подписи общий.
export const TOKEN_KEY = 'ns_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4100/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = readStorage(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Любая ошибка приводится к объекту с полем message на русском языке.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') return Promise.reject(error);

    if (error.response) {
      const { status, data } = error.response;

      // Токен протух или отозван — выходим и возвращаем на страницу входа.
      if (status === 401 && readStorage(TOKEN_KEY)) {
        removeStorage(TOKEN_KEY);
        window.dispatchEvent(new CustomEvent('ms:unauthorized'));
      }

      error.message = data?.message || 'Не удалось выполнить запрос';
      error.fieldErrors = data?.errors || [];
    } else if (error.code === 'ECONNABORTED') {
      error.message = 'Сервер не ответил вовремя';
    } else {
      error.message = 'Нет связи с сервером';
    }

    return Promise.reject(error);
  }
);

export default api;
