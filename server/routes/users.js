const express = require('express');
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { searchUsers, getUser } = require('../controllers/usersController');

const router = express.Router();

router.get('/', searchUsers);

router.get(
  '/:id',
  [param('id').isUUID().withMessage('Некорректный идентификатор')],
  validate,
  getUser
);

module.exports = router;
