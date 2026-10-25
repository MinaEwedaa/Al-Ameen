// Receptionist Leave Requests Routes (M7)
// Mounted under /api/v1/leave-requests

const router = require('express').Router();
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/requireRole');
const leaveController = require('./leave.controller');

router.post('/', authenticate, requireRole('receptionist'), leaveController.create);

module.exports = router;
