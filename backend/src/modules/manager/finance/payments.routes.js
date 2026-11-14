// Mounted under /api/v1/manager/payments (read only)
const router = require('express').Router();
const controller = require('./finance.controller');

router.get('/', controller.payments);

module.exports = router;