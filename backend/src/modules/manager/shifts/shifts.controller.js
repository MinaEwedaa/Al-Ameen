// Manager Shifts Controller (M6)
// Handles HTTP requests for manager shift management, overview, and roster

const shiftsService = require('./shifts.service');

async function list(req, res, next) {
  try {
    const { business_date, from, to, staff_id, shift_type, page, limit } = req.query;
    const result = await shiftsService.listShifts({
      business_date,
      from,
      to,
      staff_id,
      shift_type,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function overview(req, res, next) {
  try {
    const { business_date } = req.query;
    const result = await shiftsService.getShiftOverview(business_date);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function roster(req, res, next) {
  try {
    const { view, date, department, staff_type } = req.query;
    const result = await shiftsService.getShiftRoster({ view, date, department, staff_type });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function schedule(req, res, next) {
  try {
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await shiftsService.createShift(req.body, actorStaff, ip);
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
    const result = await shiftsService.updateShift(id, req.body, actorStaff, ip);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await shiftsService.deleteShift(id, req.query, actorStaff, ip);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function forceClose(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await shiftsService.forceCloseShift(id, req.body, actorStaff, ip);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  overview,
  roster,
  schedule,
  update,
  cancel,
  forceClose,
};
