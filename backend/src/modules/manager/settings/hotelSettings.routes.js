// Mounted under /api/v1/manager/hotel-settings
const router = require('express').Router();
const controller = require('./settings.controller');

router.get('/', controller.getHotel);
router.patch('/', controller.updateHotel);

module.exports = router;
