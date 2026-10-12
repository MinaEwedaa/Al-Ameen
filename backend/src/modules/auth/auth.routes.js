const express = require('express');
const { loginRateLimiter } = require('../../middleware/rateLimit');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/requireRole');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/login', loginRateLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, requireRole('receptionist'), authController.me);

module.exports = router;
