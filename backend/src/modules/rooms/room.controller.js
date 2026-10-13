const roomService = require('./room.service');
const { getNow } = require('../../utils/clock');

async function listRooms(req, res, next) {
  try {
    const { status, room_type, page, limit } = req.query;
    res.status(200).json(await roomService.listRooms({ status, room_type, page, limit }, getNow(req)));
  } catch (err) {
    next(err);
  }
}

async function checkAvailability(req, res, next) {
  try {
    const { check_in, check_out, room_type } = req.query;
    res.status(200).json(
      await roomService.checkAvailability({ check_in, check_out, room_type }, getNow(req))
    );
  } catch (err) {
    next(err);
  }
}

async function getRoom(req, res, next) {
  try {
    res.status(200).json(await roomService.getRoom(req.params.room_id, getNow(req)));
  } catch (err) {
    next(err);
  }
}

async function changeRoomStatus(req, res, next) {
  try {
    const { status, notes } = req.body; // الحقول المسموحة بالاسم بس
    const result = await roomService.changeStatus({
      roomId: req.params.room_id,
      status,
      notes,
      staff: req.auth.staff,
      shift: req.shift,
      ip: req.ip,
      now: getNow(req),
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getRoomStatusHistory(req, res, next) {
  try {
    const { page, limit } = req.query;
    res.status(200).json(await roomService.getStatusHistory(req.params.room_id, { page, limit }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRooms,
  checkAvailability,
  getRoom,
  changeRoomStatus,
  getRoomStatusHistory,
};