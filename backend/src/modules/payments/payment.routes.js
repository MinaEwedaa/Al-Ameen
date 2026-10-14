const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const idempotent = require('../../middleware/idempotency');
const paymentController = require('./payment.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('receptionist'));

router.post('/', requireShift, idempotent(), paymentController.createPayment);
router.get('/', paymentController.listShiftPayments);

module.exports = router;