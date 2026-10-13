const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const dashboardController = require('./dashboard.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('receptionist'));

// قراءة بس: من غير requireShift، فشغالة في الجلسة القراءة فقط
router.get('/', dashboardController.getDashboard);

module.exports = router;