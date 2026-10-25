const { E } = require('../utils/errors');

const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth || !req.auth.staff || !roles.includes(req.auth.staff.role)) {
    return next(E.forbidden());
  }
  next();
};

module.exports = requireRole;
module.exports.requireRole = requireRole;

