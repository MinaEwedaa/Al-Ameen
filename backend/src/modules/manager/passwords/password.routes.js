const router = require('express').Router();
const idempotent = require('../../../middleware/idempotency');
const passwordController = require('./password.controller');

router.get('/', passwordController.list);
router.patch('/:id/decision', idempotent({ redact: ['temporary_password'] }), passwordController.decide);

module.exports = router;
