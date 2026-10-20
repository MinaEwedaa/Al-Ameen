const paymentService = require('./payment.service');
const { getNow } = require('../../utils/clock');

async function createPayment(req, res, next) {
  try {
    // الحقول المسموحة بالاسم بس. shift_id و staff_id بييجوا من الجلسة دايمًا
    const { reservation_id, room_id, amount, payment_method, notes } = req.body;
    const result = await paymentService.createPayment({
      reservation_id,
      room_id,
      amount,
      payment_method,
      notes,
      staff: req.auth.staff,
      shift: req.shift,
      ip: req.ip,
      now: getNow(req),
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function listShiftPayments(req, res, next) {
  try {
    const { page, limit } = req.query;
    // جلسة القراءة فقط مفيهاش shift_id فبترجع قائمة فاضية
    const result = await paymentService.listShiftPayments({
      shiftId: req.auth.session.shift_id,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listReservationPayments(req, res, next) {
  try {
    const result = await paymentService.listReservationPayments(req.params.reservation_id, getNow(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createPayment, listShiftPayments, listReservationPayments };