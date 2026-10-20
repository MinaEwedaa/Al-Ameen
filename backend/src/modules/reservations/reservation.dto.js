const { DateTime } = require('luxon');
const { toEgp } = require('../../utils/money');
const { ZONE } = require('../../utils/time');
const { toGuestDto } = require('../guests/guest.service');
const { toRoomDto } = require('../rooms/room.dto');
const { toPaymentDto } = require('../payments/payment.dto');

// التواريخ بتتبعت بتوقيت القاهرة مع الـ offset (مثلاً +03:00)
const cairoIso = (d) => (d ? DateTime.fromJSDate(new Date(d)).setZone(ZONE).toISO() : null);

const idOrNull = (v) => (v ? String(v) : null);

function toReservationDto(r) {
  const paid = r.paid_cache || 0;

  const dto = {
    reservation_id: String(r._id),
    guest_id: String(r.guest_id?._id || r.guest_id),
    room_id: String(r.room_id?._id || r.room_id),
    check_in: cairoIso(r.check_in_at),
    check_out: cairoIso(r.check_out_at),
    reservation_date: cairoIso(r.createdAt),
    status: r.status,
    half_day_extensions: r.half_day_extensions || 0,
    early_arrival: Boolean(r.early_arrival),
    total_amount: toEgp(r.total_amount),
    paid_amount: toEgp(paid),
    remaining_amount: toEgp(r.total_amount - paid),
    check_in_staff_id: idOrNull(r.check_in_staff_id),
    check_in_shift_id: idOrNull(r.check_in_shift_id),
    check_out_staff_id: idOrNull(r.check_out_staff_id),
    check_out_shift_id: idOrNull(r.check_out_shift_id),
  };

  // refund_pending بيظهر بس لو الحجز ملغي وفيه مدفوع
  if (r.status === 'cancelled' && paid > 0) dto.refund_pending = true;

  return dto;
}

function toReservationDetailDto(r, { guest, room, payments = [] } = {}) {
  const base = toReservationDto(r);
  return {
    ...base,
    guest: guest ? toGuestDto(guest) : null,
    room: room ? toRoomDto(room) : null,
    payments: payments.map(toPaymentDto),
  };
}

module.exports = { toReservationDto, toReservationDetailDto };