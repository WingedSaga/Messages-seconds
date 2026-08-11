const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/callsController');

const router = express.Router();
const id = (chain) => chain.isUUID().withMessage('Некорректный идентификатор');

router.post('/', [id(body('conversation_id')), body('type').isIn(['audio', 'video'])], validate, controller.startCall);
router.get('/incoming', controller.incomingCalls);
router.use('/:id', [id(param('id'))], validate, controller.accessCall);
router.get('/:id', controller.getCall);
router.post('/:id/accept', controller.acceptCall);
router.post('/:id/reject', controller.finishCall('rejected'));
router.post('/:id/end', controller.finishCall('ended'));
router.get('/:id/signals', [query('after').optional().isInt({ min: 0 })], validate, controller.getSignals);
router.post(
  '/:id/signals',
  [body('kind').isIn(['offer', 'answer', 'candidate']), body('payload').isObject()],
  validate,
  controller.addSignal
);

module.exports = router;
