const mongoose = require('mongoose');
const { Payment, Reservation, RoomNight, Room, Guest } = require('../../db/models');
const { E } = require('../../utils/errors');
const { isObjectId } = require('../../utils/ids');
const { toPiastres, toEgp } = require('../../utils/money');
const { stayDay } = require('../../utils/time');
const { sanitizeText } = require('../../utils/arabic');
const { paginate } = require('../../utils/paginate');
const { audit } = require('../audit/audit.service');
const { AUDIT } = require('../audit/audit.actions');
const { toPaymentDto } = require('./payment.dto');

const OPEN = ['confirmed', 'checked_in'];
const isDuplicateKey = (err) => err && err.code === 11000;

function parseAmount(raw) {
  let amount;
  try {
    amount = toPiastres(raw);
  } catch (e) {
    throw E.validation('amount must have at most 2 decimal places');
  }
  if (!Number.isInteger(amount) || amount <= 0) throw E.validation('amount must be greater than 0');
  return amount;
}

// تحديد الحجز: reservation_id أولًا، وإلا room_id
async function resolveReservation({ reservation_id, room_id, now }, session) {
  if (reservation_id) {
    const r = isObjectId(reservation_id)
      ? await Reservation.findById(reservation_id).session(session)
      : null;
    if (!r) throw E.notFound('Reservation not found');
    return r;
  }

  if (!room_id) throw E.notFound('Reservation not found');

  let targetRoomId = isObjectId(room_id) ? room_id : null;
  if (!targetRoomId) {
    const roomDoc = await Room.findOne({ room_number: String(room_id) }).session(session);
    if (!roomDoc) throw E.notFound('Reservation not found');
    targetRoomId = roomDoc._id;
  }

  const checkedIn = await Reservation.find({ room_id: targetRoomId, status: 'checked_in' }).session(session);
  const nights = await RoomNight.find({ room_id: targetRoomId, day: stayDay(now) }).session(session).lean();
  const confirmed = nights.length
    ? await Reservation.find({
        _id: mongoose.trusted({ $in: nights.map((n) => n.reservation_id) }),
        status: 'confirmed',
      }).session(session)
    : [];

  const matches = [...checkedIn, ...confirmed];
  if (matches.length === 0) throw E.notFound('Reservation not found');
  if (matches.length > 1) {
    throw E.conflict(
      'More than one reservation matches this room. Send reservation_id.',
      'AMBIGUOUS_RESERVATION'
    );
  }
  return matches[0];
}

async function createPayment({
  reservation_id, room_id, amount: rawAmount, payment_method, notes,
  staff, shift, ip, now, idempotencyKey,
}) {
  const amount = parseAmount(rawAmount);

  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const r = await resolveReservation({ reservation_id, room_id, now }, session);

      if (!OPEN.includes(r.status)) throw E.conflict('Reservation is not open for payments');

      // الشرط ده هو اللي بيمنع تعدّي المتبقي حتى مع طلبين متزامنين
      const upd = await Reservation.updateOne(
        {
          _id: r._id,
          status: mongoose.trusted({ $in: OPEN }),
          $expr: mongoose.trusted({ $lte: [{ $add: ['$paid_cache', amount] }, '$total_amount'] }),
        },
        { $inc: { paid_cache: amount } },
        { session }
      );

      if (upd.modifiedCount !== 1) {
        const fresh = await Reservation.findById(r._id).session(session);
        if (!OPEN.includes(fresh.status)) throw E.conflict('Reservation is not open for payments');
        throw E.validation(
          `amount must be greater than 0 and not more than the remaining amount (${toEgp(
            fresh.total_amount - fresh.paid_cache
          ).toFixed(2)}).`
        );
      }

      const [payment] = await Payment.create(
        [{
          reservation_id: r._id,
          staff_id: staff._id,
          shift_id: shift._id,
          amount,
          payment_method,
          notes: notes ? sanitizeText(notes) : '',
          payment_datetime: now,
          payment_verified: false,
          idempotency_key: idempotencyKey || null,
        }],
        { session }
      );

      await audit(
        {
          action: AUDIT.PAYMENT_CREATED,
          actorStaffId: staff._id,
          entity: 'Payment',
          entityId: String(payment._id),
          details: { reservation_id: String(r._id), amount, payment_method },
          ip,
        },
        { session }
      );

      const after = await Reservation.findById(r._id).session(session).lean();
      result = {
        payment: toPaymentDto(payment.toObject()),
        paid_amount: toEgp(after.paid_cache),
        remaining_amount: toEgp(after.total_amount - after.paid_cache),
      };
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw E.conflict('This payment was already recorded');
    throw err;
  } finally {
    await session.endSession();
  }

  return result;
}

// دفعات وردية الجلسة الحالية بس (قراءة فقط = قائمة فاضية)
async function listShiftPayments({ shiftId, page = 1, limit = 20 }) {
  if (!shiftId) return { data: [], meta: { page, limit, total: 0 } };
  return paginate(
    Payment,
    { shift_id: shiftId },
    {
      page: Number(page),
      limit: Number(limit),
      sort: { payment_datetime: -1 },
      populate: {
        path: 'reservation_id',
        populate: [
          { path: 'guest_id', select: 'name' },
          { path: 'room_id', select: 'room_number' },
        ],
      },
    },
    toPaymentDto
  );
}

// كل دفعات الحجز من أي وردية (ويدعم الاستعلام برقم أو معرف الغرفة)
async function listReservationPayments(identifier, now = new Date()) {
  let r = isObjectId(identifier) ? await Reservation.findById(identifier).lean() : null;

  if (!r) {
    let roomId = isObjectId(identifier) ? identifier : null;
    if (!roomId) {
      const roomDoc = await Room.findOne({ room_number: String(identifier) }).lean();
      if (roomDoc) roomId = roomDoc._id;
    }
    if (roomId) {
      r = await Reservation.findOne({ room_id: roomId, status: 'checked_in' }).lean();
      if (!r) {
        const nights = await RoomNight.find({ room_id: roomId, day: stayDay(now) }).lean();
        if (nights.length) {
          r = await Reservation.findOne({
            _id: mongoose.trusted({ $in: nights.map((n) => n.reservation_id) }),
            status: 'confirmed',
          }).lean();
        }
      }
    }
  }

  if (!r) throw E.notFound('Reservation not found');

  const payments = await Payment.find({ reservation_id: r._id }).sort({ payment_datetime: -1 }).lean();
  const guest = await Guest.findById(r.guest_id).select('name').lean();
  const room = await Room.findById(r.room_id).select('room_number').lean();

  return {
    data: payments.map(toPaymentDto),
    reservation_id: String(r._id),
    room_id: String(r.room_id),
    room_number: room?.room_number || '',
    guest_name: guest?.name || '',
    total_amount: toEgp(r.total_amount),
    paid_amount: toEgp(r.paid_cache || 0),
    remaining_amount: toEgp(r.total_amount - (r.paid_cache || 0)),
  };
}

module.exports = { createPayment, listShiftPayments, listReservationPayments };