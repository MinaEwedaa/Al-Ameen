const rateLimit = require('express-rate-limit');
const { E } = require('../utils/errors');

const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(E.tooMany('Too many attempts', 60));
  },
});

module.exports = { loginRateLimiter };
