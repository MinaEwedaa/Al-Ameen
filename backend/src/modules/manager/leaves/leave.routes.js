// Manager Leave Requests Routes (M7)
// Mounted under /api/v1/manager/leave-requests

const router = require('express').Router();
const leaveController = require('./leave.controller');

router.get('/', leaveController.list);
router.get('/:id', leaveController.getById);
router.patch('/:id/decision', leaveController.decide);

module.exports = router;
