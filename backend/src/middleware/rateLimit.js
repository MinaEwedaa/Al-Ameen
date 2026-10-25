const rateLimit = require('express-rate-limit');
const { E } = require('../utils/errors');

// 20 attempts per IP per minute. The override is honored ONLY under NODE_ENV=test
// so that test files can log in many times from the same IP (supertest).
const testMax = Number(process.env.LOGIN_RATE_LIMIT_MAX);
const LOGIN_MAX = process.env.NODE_ENV === 'test' && testMax > 0 ? testMax : 20;

const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(E.tooMany('Too many attempts', 60));
  },
});

const generalTestMax = Number(process.env.GENERAL_RATE_LIMIT_MAX);
const GENERAL_MAX = process.env.NODE_ENV === 'test' && generalTestMax > 0 ? generalTestMax : 300;

const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: GENERAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(E.tooMany('Too many requests', 60));
  },
});

const changePasswordTestMax = Number(process.env.CHANGE_PASSWORD_RATE_LIMIT_MAX);
const CHANGE_PASSWORD_MAX =
  process.env.NODE_ENV === 'test' && changePasswordTestMax > 0 ? changePasswordTestMax : 5;

const changePasswordRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: CHANGE_PASSWORD_MAX,
  keyGenerator: (req) => String(req.auth?.staff?._id || req.ip),
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(E.tooMany('Too many change password attempts', 60));
  },
});

const resetTestMax = Number(process.env.RESET_RATE_LIMIT_MAX);
const RESET_MAX = process.env.NODE_ENV === 'test' && resetTestMax > 0 ? resetTestMax : 5;

const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: RESET_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(E.tooMany('Too many password reset requests', 3600));
  },
});

module.exports = {
  loginRateLimiter,
  generalRateLimiter,
  changePasswordRateLimiter,
  passwordResetRateLimiter,
};