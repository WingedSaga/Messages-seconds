require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/authMiddleware');

if (!process.env.JWT_SECRET) {
  throw new Error('Не задана переменная окружения JWT_SECRET. См. server/.env.example');
}

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

const builtInAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://news-seconds.duckdns.org',
  'https://messages-seconds.duckdns.org',
  'https://wingedsaga.github.io',
];

const allowedOrigins = [...builtInAllowedOrigins, ...(process.env.CORS_ORIGIN || '').split(',')]
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== '*');

app.use((req, res, next) => {
  if (allowedOrigins.includes(req.get('Origin'))) {
    res.setHeader('Access-Control-Allow-Credentials', 'false');
  }
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      // Запросы без Origin (curl, health-check) пропускаем.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Источник запроса не разрешён политикой CORS'));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);

const { apiLimiter } = require('./middleware/rateLimiters');
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'soobshcheniya-sekundy-api' });
});

app.use('/api/auth', require('./routes/auth'));

// Дальше без исключений: переписка не бывает публичной.
app.use('/api/users', authMiddleware, require('./routes/users'));
app.use('/api/conversations', authMiddleware, require('./routes/conversations'));
app.use('/api/messages', authMiddleware, require('./routes/messages'));
app.use('/api/calls', authMiddleware, require('./routes/calls'));
app.use('/api/upload', authMiddleware, require('./routes/upload'));
app.use('/api/admin', authMiddleware, require('./middleware/adminMiddleware').adminMiddleware, require('./routes/admin'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4100;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[server] СООБЩЕНИЯ СЕКУНДЫ API запущен на порту ${PORT}`);

    // Отставшая база — самая частая причина ошибок 500. Проверяем на старте,
    // чтобы это было видно в логе, а не по жалобе на белый экран.
    require('./db/checkSchema').checkSchema();
    require('./db/supabase').ensureStorageBucket().catch((error) => {
      console.error('[storage] bucket preparation failed:', error.message);
    });
  });
}

module.exports = app;
