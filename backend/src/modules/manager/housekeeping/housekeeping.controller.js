// Manager Housekeeping Controller

const housekeepingService = require('./housekeeping.service');

async function list(req, res, next) {
  try {
    const { status, priority, room_id, page, limit } = req.query;
    const result = await housekeepingService.listHousekeepingTasks({
      status,
      priority,
      room_id,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function assign(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await housekeepingService.assignHousekeepingTask(id, req.body, actorStaff, ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  assign,
};
