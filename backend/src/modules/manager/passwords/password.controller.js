const passwordService = require('./password.service');

async function list(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await passwordService.listPasswordResetRequests({
      status,
      page,
      limit,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function decide(req, res, next) {
  try {
    const { id } = req.params;
    const { action, manager_comment } = req.body;
    const result = await passwordService.decidePasswordResetRequest({
      id,
      action,
      manager_comment,
      managerStaffId: req.auth.staff._id,
      ip: req.ip,
    });
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  decide,
};
