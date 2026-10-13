const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const guestController = require('./guest.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('receptionist'));

router.post('/', requireShift, guestController.createGuest);
router.get('/', guestController.searchGuests);
router.get('/:guest_id', guestController.getGuestById);

module.exports = router;