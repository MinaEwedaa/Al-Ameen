const router = require('express').Router();
const controller = require('./reports.controller');

router.get('/aggregated', controller.getAggregated);

module.exports = router;

