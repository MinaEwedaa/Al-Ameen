const { DateTime } = require('luxon');
const { toEgp } = require('../../utils/money');
const { ZONE } = require('../../utils/time');

const cairoIso = (d) => (d ? DateTime.fromJSDate(new Date(d)).setZone(ZONE).toISO() : null);
const idOrNull = (v) => (v ? String(v) : null);

function toPaymentDto(p) {
  const reservationId = p.reservation_id?._id ? String(p.reservation_id._id) : (p.reservation_id ? String(p.reservation_id) : null);
  const guestName = p.reservation_id?.guest_id?.name || p.guest_name || null;
  const roomNumber = p.reservation_id?.room_id?.room_number || p.room_number || null;

  return {
    payment_id: String(p._id),
    reservation_id: reservationId,
    staff_id: String(p.staff_id),
    shift_id: String(p.shift_id),
    amount: toEgp(p.amount),
    payment_method: p.payment_method,
    notes: p.notes || null,
    payment_datetime: cairoIso(p.payment_datetime),
    payment_verified: Boolean(p.payment_verified),
    reversal_of_payment_id: idOrNull(p.reversal_of_payment_id),
    guest_name: guestName,
    room_number: roomNumber,
  };
}

module.exports = { toPaymentDto };