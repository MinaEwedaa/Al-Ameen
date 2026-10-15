const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const shiftController = require('./shift.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('receptionist'));

router.get('/current', shiftController.getCurrentShift);
router.get('/current/summary', shiftController.getShiftSummary);
router.patch('/current/handover', requireShift({ allowHandoverOnly: true }), shiftController.handoverShift);
router.get('/:shift_id/report', shiftController.getShiftReport);

module.exports = router;
