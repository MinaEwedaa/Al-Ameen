// Mounted under /api/v1/manager/approvals
const router = require('express').Router();
const idempotent = require('../../../middleware/idempotency');
const controller = require('./approvals.controller');

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.patch('/:id/decision', idempotent(), controller.decide);

module.exports = router;