const dashboardService = require('./dashboard.service');
const { getNow } = require('../../utils/clock');

async function getDashboard(req, res, next) {
  try {
    res.status(200).json(await dashboardService.getDashboard(req.auth.session, getNow(req)));
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };