const router = require('express').Router();
const idempotent = require('../../../middleware/idempotency');
const noStore = require('../../../middleware/noStore');
const passwordController = require('./password.controller');

router.get('/', passwordController.list);
router.patch('/:id/decision', noStore, idempotent({ redact: ['temporary_password'] }), passwordController.decide);

module.exports = router;
