const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimiters');
const {
  register,
  login,
  me,
  updateProfile,
  changePassword,
} = require('../controllers/authController');

const router = express.Router();

// Требования к имени и паролю совпадают с сайтом: аккаунт один и тот же,
// и расхождение выглядело бы как поломка входа.
const usernameRules = (chain) =>
  chain
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Имя пользователя должно быть от 3 до 30 символов')
    .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_-]+$/)
    .withMessage('Имя может содержать только буквы, цифры, дефис и подчёркивание');

router.post(
  '/register',
  registrationLimiter,
  [
    usernameRules(body('username')),
    body('email').trim().isEmail().withMessage('Введите корректный email').normalizeEmail(),
    body('password')
      .isLength({ min: 6, max: 72 })
      .withMessage('Пароль должен быть не короче 6 символов'),
  ],
  validate,
  register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Введите корректный email').normalizeEmail(),
    body('password').notEmpty().withMessage('Введите пароль'),
  ],
  validate,
  login
);

router.get('/me', authMiddleware, me);

router.patch(
  '/profile',
  authMiddleware,
  [
    usernameRules(body('username').optional()),
    body('avatar_url')
      .optional({ values: 'null' })
      .trim()
      .custom((value) => value === '' || /^https?:\/\/\S+$/.test(value))
      .withMessage('Ссылка на аватар некорректна'),
  ],
  validate,
  updateProfile
);

router.patch(
  '/password',
  authMiddleware,
  authLimiter,
  [
    body('current_password').notEmpty().withMessage('Введите текущий пароль'),
    body('password')
      .isLength({ min: 6, max: 72 })
      .withMessage('Пароль должен быть не короче 6 символов'),
  ],
  validate,
  changePassword
);

module.exports = router;
