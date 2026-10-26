// Mounted under /api/v1/approval-requests (receptionist)
const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const controller = require('./approval.controller');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('receptionist'));

router.post('/', requireShift, controller.create);

module.exports = router;