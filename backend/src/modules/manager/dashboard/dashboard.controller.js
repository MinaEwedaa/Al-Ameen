// Manager Dashboard Controller
const dashboardService = require('./dashboard.service');

async function overview(req, res, next) {
  try {
    const data = await dashboardService.getOverview();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function revenue(req, res, next) {
  try {
    const { days } = req.query;
    const data = await dashboardService.getRevenue(days);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function issues(req, res, next) {
  try {
    const { limit } = req.query;
    const data = await dashboardService.getIssues(limit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  overview,
  revenue,
  issues,
};
