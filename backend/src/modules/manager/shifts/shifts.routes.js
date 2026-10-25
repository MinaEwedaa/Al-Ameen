// Manager Shifts Routes (M6)
// Mounted under /api/v1/manager/shifts

const router = require('express').Router();
const shiftsController = require('./shifts.controller');

// Static routes registered first
router.get('/overview', shiftsController.overview);
router.get('/roster', shiftsController.roster);

// Collection routes
router.get('/', shiftsController.list);
router.post('/', shiftsController.schedule);

// Param routes
router.patch('/:id', shiftsController.update);
router.delete('/:id', shiftsController.cancel);
router.post('/:id/force-close', shiftsController.forceClose);

module.exports = router;
