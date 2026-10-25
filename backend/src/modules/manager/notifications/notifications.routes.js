const router = require('express').Router();
const controller = require('./notifications.controller');

router.get('/', controller.list);
router.post('/read-all', controller.markAllRead);
router.get('/preferences', controller.getPreferences);
router.patch('/preferences', controller.updatePreferences);
router.patch('/:id/read', controller.markRead);

module.exports = router;
