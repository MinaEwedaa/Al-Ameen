const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const idempotent = require('../../middleware/idempotency');
const reservationController = require('./reservation.controller');
const paymentController = require('../payments/payment.controller');
const router = express.Router();

router.use(authenticate);
router.use(requireRole('receptionist'));

router.post('/', requireShift, idempotent(), reservationController.createReservation);
router.get('/:reservation_id/payments', paymentController.listReservationPayments);
router.post('/:reservation_id/check-in', requireShift, idempotent(), reservationController.checkIn);
router.post('/:reservation_id/extend', requireShift, idempotent(), reservationController.extendStay);
router.post('/:reservation_id/check-out', requireShift, idempotent(), reservationController.checkOut);

module.exports = router;