const router = require('express').Router();
const controller = require('./maintenance.controller');

router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id', controller.update);

module.exports = router;

