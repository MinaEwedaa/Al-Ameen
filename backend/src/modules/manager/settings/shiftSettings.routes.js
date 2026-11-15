// Mounted under /api/v1/manager/shift-settings
const router = require('express').Router();
const controller = require('./settings.controller');

router.get('/', controller.getShifts);
router.patch('/', controller.updateShifts);

module.exports = router;
