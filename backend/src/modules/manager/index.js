const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

router.use(authenticate, requireRole('manager', 'admin'));

router.use('/password-reset-requests', require('./passwords/password.routes'));
router.use('/notifications', require('./notifications/notifications.routes'));
router.use('/staff', require('./staff/staff.routes'));
router.use('/shifts', require('./shifts/shifts.routes'));
router.use('/rooms', require('./rooms/rooms.routes'));
router.use('/room-types', require('./roomTypes/roomTypes.routes'));
router.use('/housekeeping-tasks', require('./housekeeping/housekeeping.routes'));
router.use('/dashboard', require('./dashboard/dashboard.routes'));
router.use('/activities', require('./activities/activities.routes'));
router.use('/leave-requests', require('./leaves/leave.routes'));

module.exports = router;
