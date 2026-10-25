// Manager Activities Controller
const activitiesService = require('./activities.service');

async function list(req, res, next) {
  try {
    const { limit } = req.query;
    const data = await activitiesService.getActivities(limit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
};
