const service = require('./maintenance.service');

async function list(req, res, next) {
  try {
    const result = await service.listMaintenanceIssues(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await service.createMaintenanceTicket({
      ...req.body,
      staff: req.auth?.staff,
      ip: req.ip,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const result = await service.updateMaintenanceTicket({
      id: req.params.id,
      ...req.body,
      staff: req.auth?.staff,
      ip: req.ip,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  update,
};

