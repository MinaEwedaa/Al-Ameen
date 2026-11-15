// Manager Staff Routes
// Mounts under /api/v1/manager/staff

const router = require('express').Router();
const staffController = require('./staff.controller');
const noStore = require('../../../middleware/noStore');
const { managerResetStaffPasswordRateLimiter } = require('../../../middleware/rateLimit');

router.get('/', staffController.list);
router.post('/', noStore, staffController.create);
router.get('/:id', staffController.getById);
router.patch('/:id', staffController.update);
router.delete('/:id', staffController.deactivate);
router.post('/:id/reactivate', staffController.reactivate);
router.post('/:id/reset-password', noStore, managerResetStaffPasswordRateLimiter, staffController.resetPassword);

module.exports = router;
