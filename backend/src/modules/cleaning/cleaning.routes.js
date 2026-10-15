const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const controller = require('./cleaning.controller');

router.use(authenticate, requireRole('receptionist'));

router.post('/', requireShift, controller.createCleaningTask);
router.get('/', controller.listCleaningTasks);
router.get('/:task_id', controller.getCleaningTask);
router.patch('/:task_id', requireShift, controller.updateCleaningTask);

module.exports = router;
