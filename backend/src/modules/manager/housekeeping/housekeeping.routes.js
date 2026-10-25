// Manager Housekeeping Routes
// Mounts under /api/v1/manager/housekeeping-tasks

const router = require('express').Router();
const housekeepingController = require('./housekeeping.controller');

router.get('/', housekeepingController.list);
router.patch('/:id/assign', housekeepingController.assign);

module.exports = router;
