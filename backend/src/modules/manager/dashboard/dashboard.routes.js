// Manager Dashboard Routes
// Mounts under /api/v1/manager/dashboard

const router = require('express').Router();
const dashboardController = require('./dashboard.controller');

router.get('/overview', dashboardController.overview);
router.get('/revenue', dashboardController.revenue);
router.get('/issues', dashboardController.issues);

module.exports = router;
