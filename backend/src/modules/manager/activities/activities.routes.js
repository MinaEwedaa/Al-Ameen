// Manager Activities Routes
// Mounts under /api/v1/manager/activities

const router = require('express').Router();
const activitiesController = require('./activities.controller');

router.get('/', activitiesController.list);

module.exports = router;
