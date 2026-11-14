// Mounted under /api/v1/manager/daily-closings
const router = require('express').Router();
const idempotent = require('../../../middleware/idempotency');
const controller = require('./finance.controller');

router.get('/current', controller.current);
router.post('/open', idempotent(), controller.open);
router.post('/close', idempotent(), controller.close);
router.get('/', controller.list);

module.exports = router;