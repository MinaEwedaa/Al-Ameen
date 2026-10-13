const reservationService = require('./reservation.service');
const { getNow } = require('../../utils/clock');

async function createReservation(req, res, next) {
  try {
    const { guest_id, room_id, check_in, check_out } = req.body; // الحقول المسموحة بالاسم بس
    const result = await reservationService.createReservation({
      guest_id,
      room_id,
      check_in,
      check_out,
      staff: req.auth.staff,
      ip: req.ip,
      now: getNow(req),
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createReservation };