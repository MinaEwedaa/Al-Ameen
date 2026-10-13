const { toEgp } = require('../../utils/money');

function toRoomDto(room, { status, guestName = null } = {}) {
  return {
    room_id: String(room._id),
    room_number: room.room_number,
    floor: room.floor ?? null,
    room_type: room.room_type,
    status: status || room.status,
    description: room.description || '',
    price_per_night: toEgp(room.price_per_night),
    half_day_price: toEgp(room.half_day_price),
    current_guest_name: guestName,
    updated_at: room.updatedAt ? new Date(room.updatedAt).toISOString() : null,
  };
}

function toHistoryDto(h) {
  return {
    history_id: String(h._id),
    room_id: String(h.room_id),
    status: h.status,
    notes: h.notes ? h.notes : null,
    changed_at: new Date(h.changed_at).toISOString(),
    shift_id: h.shift_id ? String(h.shift_id) : null,
  };
}

module.exports = { toRoomDto, toHistoryDto };