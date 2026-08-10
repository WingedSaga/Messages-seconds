# СООБЩЕНИЯ СЕКУНДЫ

Мессенджер к сайту [НОВОСТИ СЕКУНДЫ](https://news-seconds.duckdns.org).
Светло-зелёная тема, весь интерфейс на русском, аккаунт общий с сайтом.

| Часть | Технологии |
|---|---|
| Клиент | React 18, Vite 5, React Router 6, Tailwind, axios, lucide-react |
| Сервер | Node 22, Express 4, JWT, multer |
| База и файлы | тот же проект Supabase, что у сайта |

## Что уже работает

- вход и регистрация; тот же аккаунт, что на сайте новостей;
- личные переписки и группы, поиск человека по имени;
- отправка, правка и удаление своих сообщений, ответ с цитатой;
- вложения: картинки и файлы, картинка открывается на весь экран;
- непрочитанные, отметка «прочитано», «в сети» и «печатает»;
- список чатов с поиском, счётчик непрочитанных в заголовке вкладки;
- профиль: имя, фотография, смена пароля;
- вёрстка для телефона: список и разговор — два отдельных экрана.

Обновление без веб-сокетов: вкладка сама опрашивает сервер — сообщения раз
в 2,5 секунды, список чатов раз в 5. Скрытая вкладка опрашивает в шесть раз
реже. Сокеты за туннелем Tailscale рвутся при каждом переподключении, а
короткий опрос переживает и обрыв связи, и сон телефона.

## Аккаунт общий с сайтом

Мессенджер ходит в ту же таблицу `public.users`, что и сайт, и проверяет токен
тем же секретом. Практически это значит:

- `JWT_SECRET` в `server/.env` **обязан совпадать** с секретом сайта;
- имя и фотография меняются сразу в обоих местах;
- когда мессенджер переедет на `news-seconds.duckdns.org`, вход на сайте
  станет и входом в переписку: ключ в localStorage один и тот же (`ns_token`).

## Запуск у себя

```bash
# сервер
cd server
cp .env.example .env      # заполнить SUPABASE_*, JWT_SECRET
npm install
npm run dev               # http://localhost:4100

# клиент
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5174
```

Перед первым запуском выполните `server/db/schema.sql` в Supabase → SQL Editor
и создайте публичный бакет `chat-media` в Storage.

## Установка на Raspberry Pi

Рядом с сайтом, на своём порту:

```bash
cd ~ && git clone https://github.com/WingedSaga/Messages-seconds.git
cd Messages-seconds/server && npm ci --omit=dev
cp .env.example .env && chmod 600 .env   # заполнить значения
```

Служба systemd `/etc/systemd/system/messages-seconds.service`:

```ini
[Unit]
Description=СООБЩЕНИЯ СЕКУНДЫ API
After=network.target

[Service]
Type=simple
User=wingedsaga
WorkingDirectory=/home/wingedsaga/Messages-seconds/server
ExecStart=/usr/bin/node index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now messages-seconds
tailscale funnel --bg 4100        # наружу, как у сайта
```

Правильный лог запуска — две строки без ошибок:

```
[server] СООБЩЕНИЯ СЕКУНДЫ API запущен на порту 4100
[schema] структура базы соответствует коду
```

## Сборка клиента

GitHub Actions собирает `client/` и кладёт на GitHub Pages в подпапку
`/Messages-seconds/`. Адрес API берётся из переменной `VITE_API_URL`
(Settings → Secrets and variables → Actions → Variables) — без неё сборка
будет ходить на `localhost` и работать не станет.

## Что дальше

- звонки;
- уведомления на телефон;
- пересылка сообщений;
- переезд на `news-seconds.duckdns.org/messages`, чтобы вход был один.
