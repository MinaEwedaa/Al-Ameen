const mongoose = require('mongoose');
const { Room, RoomNight, Reservation, Guest } = require('../../db/models');
const { E } = require('../../utils/errors');
const { isObjectId } = require('../../utils/ids');
const { cairoDate, stayDay, noonCairo, nightsBetween, stayDays } = require('../../utils/time');
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

module.exports = { createReservation };
