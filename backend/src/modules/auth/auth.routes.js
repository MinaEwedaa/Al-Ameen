const express = require('express');
const {
  loginRateLimiter,
  changePasswordRateLimiter,
  passwordResetRateLimiter,
} = require('../../middleware/rateLimit');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/login', loginRateLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, requireRole('manager', 'admin'), authController.updateMe);
router.post(
  '/change-password',
  authenticate,
  requireRole('manager', 'admin'),
  changePasswordRateLimiter,
  authController.changePassword
);
router.get('/me/stats', authenticate, requireRole('manager', 'admin'), authController.getStats);
router.get('/me/activities', authenticate, requireRole('manager', 'admin'), authController.getActivities);
router.post('/password-reset-requests', passwordResetRateLimiter, authController.requestPasswordReset);

module.exports = router;
