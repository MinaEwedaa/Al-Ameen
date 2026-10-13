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

module.exports = { loginRateLimiter };