const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const requireShift = require('../../middleware/requireShift');
const roomController = require('./room.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('receptionist'));

router.get('/', roomController.listRooms);
router.get('/availability', roomController.checkAvailability); // لازم قبل /:room_id
router.get('/:room_id', roomController.getRoom);
router.patch('/:room_id/status', requireShift, roomController.changeRoomStatus);
router.get('/:room_id/status-history', roomController.getRoomStatusHistory);

module.exports = router;