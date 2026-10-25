// Manager Room Types Routes

const router = require('express').Router();
const roomTypesController = require('./roomTypes.controller');

router.get('/', roomTypesController.list);
router.post('/', roomTypesController.create);
router.get('/:id', roomTypesController.getById);
router.patch('/:id', roomTypesController.update);

module.exports = router;
