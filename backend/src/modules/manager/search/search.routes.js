// Mounted under /api/v1/manager/search
const router = require('express').Router();
const controller = require('./search.controller');

router.get('/', controller.search);

module.exports = router;

