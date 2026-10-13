const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const idempotent = require('../../middleware/idempotency');
const reservationController = require('./reservation.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('receptionist'));

router.post('/', requireShift, idempotent(), reservationController.createReservation);

module.exports = router;