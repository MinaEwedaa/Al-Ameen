const mongoose = require('mongoose');
const {
  Room,
  RoomNight,
  Reservation,
  Guest,
  RoomStatusHistory,
  CleaningTask,
} = require('../../db/models');
const { E } = require('../../utils/errors');
const { isObjectId } = require('../../utils/ids');
const { cairoDate, stayDay, noonCairo, nightsBetween, stayDays } = require('../../utils/time');
const { toEgp } = require('../../utils/money');
const { audit } = require('../audit/audit.service');
const { AUDIT } = require('../audit/audit.actions');
const { computeTotal } = require('./reservation.calc');
const { toReservationDto } = require('./reservation.dto');

const isDuplicateKey = (err) => err && err.code === 11000;

// تحويل أي تاريخ لشكل يوم القاهرة، ورفض التاريخ الغلط
function toCairoDay(value, field) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw E.validation(`${field} must be a valid date`);
  return cairoDate(d);
}

async function createReservation({ guest_id, room_id, check_in, check_out, staff, ip, now }) {
  // a. الضيف والغرفة لازم يكونوا موجودين
  if (!isObjectId(guest_id) || !(await Guest.exists({ _id: guest_id }))) {
    throw E.notFound('Guest not found');
  }
  const room = isObjectId(room_id) ? await Room.findById(room_id).lean() : null;
  if (!room) throw E.notFound('Room not found');

  // b. الأيام والليالي (بتوقيت القاهرة)
  const inDay = toCairoDay(check_in, 'check_in');
  const outDay = toCairoDay(check_out, 'check_out');
  const nights = nightsBetween(inDay, outDay);
  if (nights < 1) throw E.validation('check_out must be at least one day after check_in');
  if (inDay < stayDay(now)) throw E.validation('check_in cannot be in the past');

  // c. الغرفة في الصيانة
  if (room.status === 'maintenance') {
    throw E.conflict('Room is under maintenance');
  }

  // d. الوقت المخزّن دايمًا 12:00 ظهرًا بتوقيت القاهرة
  const check_in_at = noonCairo(inDay);
  const check_out_at = noonCairo(outDay);

  const fields = {
    guest_id,
    room_id: room._id,
    check_in_at,
    check_out_at,
    nights,
    status: 'confirmed',
    price_per_night_snapshot: room.price_per_night,
    half_day_price_snapshot: room.half_day_price,
    half_day_extensions: 0,
    early_arrival: false,
    paid_cache: 0,
  };
  fields.total_amount = computeTotal(fields);

  // e. كله جوه transaction واحدة
  let reservation;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [created] = await Reservation.create([fields], { session });
      reservation = created;

      await RoomNight.insertMany(
        stayDays(inDay, nights).map((day) => ({
          room_id: room._id,
          day,
          reservation_id: created._id,
        })),
        { session }
      );

      await audit(
        {
          action: AUDIT.RESERVATION_CREATED,
          actorStaffId: staff._id,
          entity: 'Reservation',
          entityId: String(created._id),
          details: { room_id: String(room._id), guest_id: String(guest_id), check_in: inDay, check_out: outDay, nights },
          ip,
        },
        { session }
      );
    });
  } catch (err) {
    // f. الـ unique index على RoomNight منع الحجز المزدوج
    if (isDuplicateKey(err)) throw E.conflict('Room is already booked for these dates');
    throw err;
  } finally {
    await session.endSession();
  }

  return toReservationDto(reservation.toObject());
}

async function checkIn({ reservation_id, early_arrival, staff, shift, ip, now }) {
  if (!isObjectId(reservation_id)) throw E.notFound('Reservation not found');
  const reservation = await Reservation.findById(reservation_id);
  if (!reservation) throw E.notFound('Reservation not found');

  if (reservation.status !== 'confirmed') {
    throw E.conflict('Reservation is not confirmed');
  }

  const room = await Room.findById(reservation.room_id);
  if (!room) throw E.notFound('Room not found');
  if (room.status !== 'available') {
    throw E.conflict(`Room is not available (current status: ${room.status}). Finish cleaning first.`);
  }

  const cNow = cairoDate(now);
  const cCheckIn = cairoDate(reservation.check_in_at);

  let isEarly = false;
  if (now >= reservation.check_in_at) {
    if (early_arrival === true) {
      throw E.conflict('Arrival is not early; do not send early_arrival: true');
    }
    isEarly = false;
  } else {
    // now < check_in_at
    if (cNow === cCheckIn) {
      if (!early_arrival) {
        throw E.conflict('Guest arrived before scheduled time. Confirm early arrival to proceed.');
      }
      isEarly = true;
    } else {
      throw E.conflict('Too early: change the reservation dates first');
    }
  }

  const newTotal = computeTotal({
    ...reservation.toObject(),
    early_arrival: isEarly,
  });

  if ((reservation.paid_cache || 0) <= 0) {
    throw E.conflict('Record at least one payment before check-in.', 'PAYMENT_REQUIRED');
  }

  let updatedReservation;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const resUpd = await Reservation.updateOne(
        { _id: reservation._id, status: 'confirmed' },
        {
          status: 'checked_in',
          check_in_staff_id: staff._id,
          check_in_shift_id: shift._id,
          early_arrival: isEarly,
          total_amount: newTotal,
        },
        { session }
      );
      if (resUpd.modifiedCount !== 1) {
        throw E.conflict('Reservation is no longer confirmed');
      }

      const roomUpd = await Room.updateOne(
        { _id: room._id, status: 'available' },
        { status: 'occupied' },
        { session }
      );
      if (roomUpd.modifiedCount !== 1) {
        throw E.conflict('Room is no longer available');
      }

      await RoomStatusHistory.create(
        [
          {
            room_id: room._id,
            shift_id: shift._id,
            staff_id: staff._id,
            status: 'occupied',
            notes: isEarly ? 'Early check-in' : 'Check-in',
            changed_at: now,
          },
        ],
        { session }
      );

      await audit(
        {
          action: AUDIT.CHECK_IN,
          actorStaffId: staff._id,
          entity: 'Reservation',
          entityId: String(reservation._id),
          details: { room_id: String(room._id), early_arrival: isEarly },
          ip,
        },
        { session }
      );

      updatedReservation = await Reservation.findById(reservation._id).session(session);
    });
  } finally {
    await session.endSession();
  }

  return toReservationDto(updatedReservation.toObject());
}

async function extendStay({ reservation_id, staff, shift, ip, now }) {
  if (!isObjectId(reservation_id)) throw E.notFound('Reservation not found');
  const reservation = await Reservation.findById(reservation_id);
  if (!reservation) throw E.notFound('Reservation not found');

  if (reservation.status !== 'checked_in') {
    throw E.conflict('Reservation is not checked in');
  }

  // تحقق لو فيه حجز تاني بيبدأ يوم الخروج
  const checkoutDay = cairoDate(reservation.check_out_at);
  const conflict = await RoomNight.exists({ room_id: reservation.room_id, day: checkoutDay });
  if (conflict) {
    throw E.conflict('Another booking starts that day');
  }

  const newExtensions = (reservation.half_day_extensions || 0) + 1;
  const newTotal = computeTotal({
    ...reservation.toObject(),
    half_day_extensions: newExtensions,
  });

  let updatedReservation;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const resUpd = await Reservation.updateOne(
        { _id: reservation._id, status: 'checked_in' },
        {
          $inc: { half_day_extensions: 1 },
          total_amount: newTotal,
        },
        { session }
      );
      if (resUpd.modifiedCount !== 1) {
        throw E.conflict('Reservation is no longer checked in');
      }

      await audit(
        {
          action: AUDIT.EXTEND,
          actorStaffId: staff._id,
          entity: 'Reservation',
          entityId: String(reservation._id),
          details: { half_day_extensions: newExtensions },
          ip,
        },
        { session }
      );

      updatedReservation = await Reservation.findById(reservation._id).session(session);
    });
  } finally {
    await session.endSession();
  }

  return toReservationDto(updatedReservation.toObject());
}

async function checkOut({ reservation_id, staff, shift, ip, now }) {
  if (!isObjectId(reservation_id)) throw E.notFound('Reservation not found');
  const reservation = await Reservation.findById(reservation_id);
  if (!reservation) throw E.notFound('Reservation not found');

  if (reservation.status !== 'checked_in') {
    throw E.conflict('Reservation is not checked in');
  }

  let updatedReservation;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const resUpd = await Reservation.updateOne(
        {
          _id: reservation._id,
          status: 'checked_in',
          $expr: { $lte: ['$total_amount', '$paid_cache'] },
        },
        {
          status: 'checked_out',
          check_out_staff_id: staff._id,
          check_out_shift_id: shift._id,
        },
        { session }
      );

      if (resUpd.modifiedCount !== 1) {
        const fresh = await Reservation.findById(reservation._id).session(session);
        if (fresh.status !== 'checked_in') {
          throw E.conflict('Reservation is not checked in');
        }
        const remaining = fresh.total_amount - fresh.paid_cache;
        throw E.conflict(
          `Check-out is blocked: ${toEgp(remaining).toFixed(2)} EGP remaining`,
          'BALANCE_DUE'
        );
      }

      const roomUpd = await Room.updateOne(
        { _id: reservation.room_id, status: 'occupied' },
        { status: 'cleaning' },
        { session }
      );
      if (roomUpd.modifiedCount !== 1) {
        throw E.conflict('Room is not occupied');
      }

      await RoomStatusHistory.create(
        [
          {
            room_id: reservation.room_id,
            shift_id: shift._id,
            staff_id: staff._id,
            status: 'cleaning',
            notes: 'Check-out cleaning',
            changed_at: now,
          },
        ],
        { session }
      );

      await CleaningTask.create(
        [
          {
            room_id: reservation.room_id,
            shift_id: shift._id,
            priority: 'medium',
            status: 'pending',
            cleaner_name: null,
            assigned_by_staff_id: null,
            assigned_at: now,
          },
        ],
        { session }
      );

      await audit(
        {
          action: AUDIT.CHECK_OUT,
          actorStaffId: staff._id,
          entity: 'Reservation',
          entityId: String(reservation._id),
          details: { room_id: String(reservation.room_id) },
          ip,
        },
        { session }
      );

      updatedReservation = await Reservation.findById(reservation._id).session(session);
    });
  } finally {
    await session.endSession();
  }

  return toReservationDto(updatedReservation.toObject());
}

module.exports = {
  createReservation,
  checkIn,
  extendStay,
  checkOut,
};
