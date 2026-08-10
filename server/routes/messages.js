const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { editMessage, deleteMessage } = require('../controllers/messagesController');

const router = express.Router();

router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('Некорректный идентификатор'),
    body('body').isLength({ max: 4000 }).withMessage('Сообщение длиннее 4000 символов'),
  ],
  validate,
  editMessage
);

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Некорректный идентификатор')],
  validate,
  deleteMessage
);

module.exports = router;
