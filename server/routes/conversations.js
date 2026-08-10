const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { messageLimiter } = require('../middleware/rateLimiters');
const {
  listConversations,
  getConversation,
  createDirect,
  createGroup,
  updateGroup,
  addMembers,
  removeMember,
  markRead,
  setTyping,
} = require('../controllers/conversationsController');
const { listMessages, sendMessage } = require('../controllers/messagesController');

const router = express.Router();

const id = (chain) => chain.isUUID().withMessage('Некорректный идентификатор');

router.get('/', listConversations);

router.post(
  '/direct',
  [id(body('user_id'))],
  validate,
  createDirect
);

router.post(
  '/group',
  [
    body('title').trim().isLength({ min: 1, max: 60 }).withMessage('Название до 60 символов'),
    body('member_ids').isArray({ min: 1 }).withMessage('Добавьте хотя бы одного участника'),
    id(body('member_ids.*')),
  ],
  validate,
  createGroup
);

router.get('/:id', [id(param('id'))], validate, getConversation);

router.patch(
  '/:id',
  [
    id(param('id')),
    body('title').optional().trim().isLength({ min: 1, max: 60 }).withMessage('Название до 60 символов'),
    body('avatar_url')
      .optional({ values: 'null' })
      .trim()
      .custom((value) => value === '' || /^https?:\/\/\S+$/.test(value))
      .withMessage('Ссылка на картинку некорректна'),
  ],
  validate,
  updateGroup
);

router.post(
  '/:id/members',
  [id(param('id')), body('user_ids').isArray({ min: 1 }), id(body('user_ids.*'))],
  validate,
  addMembers
);

router.delete(
  '/:id/members/:userId',
  [id(param('id')), id(param('userId'))],
  validate,
  removeMember
);

router.post('/:id/read', [id(param('id'))], validate, markRead);
router.post('/:id/typing', [id(param('id'))], validate, setTyping);

router.get(
  '/:id/messages',
  [
    id(param('id')),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isISO8601(),
    query('after').optional().isISO8601(),
  ],
  validate,
  listMessages
);

router.post(
  '/:id/messages',
  messageLimiter,
  [
    id(param('id')),
    body('body').optional().isLength({ max: 4000 }).withMessage('Сообщение длиннее 4000 символов'),
    body('attachment_url')
      .optional({ values: 'null' })
      .trim()
      .matches(/^https?:\/\/\S+$/)
      .withMessage('Ссылка на вложение некорректна'),
    body('attachment_type').optional({ values: 'null' }).isIn(['image', 'file']),
    body('reply_to').optional({ values: 'null' }).isUUID(),
  ],
  validate,
  sendMessage
);

module.exports = router;
