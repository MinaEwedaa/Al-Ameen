const { E } = require('../utils/errors');

const requireRole = (role) => (req, res, next) => {
  if (!req.auth || !req.auth.staff || req.auth.staff.role !== role) {
    return next(E.forbidden('Forbidden', 'FORBIDDEN'));
  }
  next();
};

module.exports = { requireRole };
