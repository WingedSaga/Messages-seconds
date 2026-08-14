const rateLimit = require('express-rate-limit');

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Опрос ленты идёт постоянно, поэтому лимит считается по пользователю,
    // а не по адресу: иначе вся домашняя сеть делит одну квоту.
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { message },
  });
}

// Общий ограничитель гасит всплески запросов до того, как они создадут
// нагрузку на базу. Более строгие лимиты ниже защищают дорогие операции.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || req.path === '/health',
  message: { message: 'Слишком много запросов. Попробуйте через минуту.' },
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Слишком много попыток. Повторите позже.',
});

const registrationLimiter = createLimiter({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: 'Слишком много регистраций с этого адреса. Попробуйте через 30 минут.',
});

// Живая переписка — это много коротких сообщений подряд, предел поставлен
// заметно выше разговорного темпа и ловит только рассылку роботом.
const messageLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Слишком много сообщений подряд. Подождите минуту.',
});

const uploadLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Слишком много вложений. Попробуйте позже.',
});

module.exports = { apiLimiter, authLimiter, registrationLimiter, messageLimiter, uploadLimiter };
