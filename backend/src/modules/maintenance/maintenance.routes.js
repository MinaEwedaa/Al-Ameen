const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const controller = require('./maintenance.controller');

router.use(authenticate, requireRole('receptionist'));

router.post('/', requireShift, controller.createMaintenanceIssue);
router.get('/', controller.listMaintenanceIssues);
router.get('/:issue_id', controller.getMaintenanceIssue);
router.patch('/:issue_id', requireShift, controller.updateMaintenanceIssue);

module.exports = router;
