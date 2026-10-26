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

router.get('/', reservationController.listReservations);
router.get('/:reservation_id', reservationController.getReservation);
router.get('/:reservation_id/payments', paymentController.listReservationPayments);
router.post('/', requireShift, idempotent(), reservationController.createReservation);
router.post('/:reservation_id/check-in', requireShift, idempotent(), reservationController.checkIn);
router.post('/:reservation_id/extend', requireShift, idempotent(), reservationController.extendStay);
router.post('/:reservation_id/check-out', requireShift, idempotent(), reservationController.checkOut);
router.post('/:reservation_id/cancel', requireShift, idempotent(), reservationController.cancel);

module.exports = router;