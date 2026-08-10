function notFound(_req, res) {
  res.status(404).json({ message: 'Маршрут не найден' });
}

// Централизованная обработка ошибок: наружу уходит только безопасный текст.
function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    message: status >= 500 ? 'Внутренняя ошибка сервера' : err.message || 'Ошибка запроса',
  });
}

module.exports = { notFound, errorHandler };
