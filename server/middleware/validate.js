const { validationResult } = require('express-validator');

// Превращает ошибки express-validator в единый JSON-формат.
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return res.status(400).json({ message: errors[0].message, errors });
}

module.exports = { validate };
