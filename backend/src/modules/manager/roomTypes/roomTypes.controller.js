// Manager Room Types Controller

const roomTypesService = require('./roomTypes.service');

async function list(req, res, next) {
  try {
    const result = await roomTypesService.listRoomTypes();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const result = await roomTypesService.getRoomType(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await roomTypesService.createRoomType(req.body, actorStaff, ip);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const actorStaff = req.auth?.staff || req.staff;
    const ip = req.ip;
    const result = await roomTypesService.updateRoomType(req.params.id, req.body, actorStaff, ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
};
