// Manager Rooms Controller (M5)

const roomsService = require('./rooms.service');

async function list(req, res, next) {
  try {
    const { page, limit, floor, room_type_id, physical_status, occupancy_status, q } = req.query;
    const result = await roomsService.listRooms({
      page,
      limit,
      floor,
      room_type_id,
      physical_status,
      occupancy_status,
      q,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await roomsService.updateRoom(id, req.body, actorStaff, ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function activities(req, res, next) {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;
    const result = await roomsService.getRoomActivities(id, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  update,
  activities,
};
