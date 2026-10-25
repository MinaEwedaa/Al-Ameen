// Manager Rooms Routes (M5)
// Mounts under /api/v1/manager/rooms

const router = require('express').Router();
const roomsController = require('./rooms.controller');

router.get('/', roomsController.list);
router.patch('/:id', roomsController.update);
router.get('/:id/activities', roomsController.activities);

module.exports = router;
