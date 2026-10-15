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

async function checkIn(req, res, next) {
  try {
    const { reservation_id } = req.params;
    const early_arrival = req.body?.early_arrival;
    const result = await reservationService.checkIn({
      reservation_id,
      early_arrival,
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

async function extendStay(req, res, next) {
  try {
    const { reservation_id } = req.params;
    const result = await reservationService.extendStay({
      reservation_id,
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

async function checkOut(req, res, next) {
  try {
    const { reservation_id } = req.params;
    const result = await reservationService.checkOut({
      reservation_id,
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

module.exports = {
  createReservation,
  checkIn,
  extendStay,
  checkOut,
};