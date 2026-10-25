// Manager Leave Requests Controller (M7)
// Handles receptionist creation and manager list, detail, and decision endpoints

const leaveService = require('./leave.service');

async function create(req, res, next) {
  try {
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await leaveService.createLeaveRequest(req.body, actorStaff, ip);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { status, staff_id, from, to, page, limit } = req.query;
    const result = await leaveService.listLeaveRequests({ status, staff_id, from, to, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await leaveService.getLeaveRequestById(id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function decide(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await leaveService.decideLeaveRequest(id, req.body, actorStaff, ip);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  decide,
};
