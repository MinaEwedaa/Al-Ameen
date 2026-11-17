const reportsService = require('./reports.service');

async function getAggregated(req, res, next) {
  try {
    const data = await reportsService.getAggregatedReport(req.query);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAggregated,
};

