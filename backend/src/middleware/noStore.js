// Middleware to prevent caching of sensitive responses
module.exports = function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
};
