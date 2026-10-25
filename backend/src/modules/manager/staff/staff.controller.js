// Manager Staff Controller
// Thin HTTP layer delegating to staff.service

const staffService = require('./staff.service');

async function list(req, res, next) {
  try {
    const { staff_type, is_active, on_shift, search, page, limit, include } = req.query;
    const result = await staffService.listStaff({
      staff_type,
      is_active,
      on_shift,
      search,
      page,
      limit,
      include,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const { include } = req.query;
    const staff = await staffService.getStaff(id, include);
    res.json({ data: staff });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;

    const result = await staffService.createStaff(req.body, actorStaff, ip);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;

    const result = await staffService.updateStaff(id, req.body, actorStaff, ip);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;

    const result = await staffService.deactivateStaff(id, actorStaff, ip);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function reactivate(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;

    const result = await staffService.reactivateStaff(id, actorStaff, ip);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;

    const result = await staffService.resetPassword(id, actorStaff, ip);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  deactivate,
  reactivate,
  resetPassword,
};
