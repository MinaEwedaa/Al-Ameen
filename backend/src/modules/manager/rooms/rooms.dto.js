// Manager Rooms DTO (M5)

const { toEgp } = require('../../../utils/money');

function toManagerRoomDto(room, { occupancyStatus = 'VACANT', physicalStatus = 'CLEAN', guestName = null } = {}) {
  const priceEgp = toEgp(room.price_per_night);

  return {
    id: String(room._id),
    room_id: String(room._id),
    room_number: room.room_number,
    floor: room.floor ?? null,
    room_type_id: room.room_type_id ? String(room.room_type_id._id || room.room_type_id) : null,
    room_type: room.room_type,
    room_type_name: room.room_type_id?.name || room.room_type,
    physical_status: physicalStatus,
    occupancy_status: occupancyStatus,
    price_per_night: priceEgp,
    rack_rate: priceEgp,
    price: priceEgp,
    current_guest: guestName,
    current_guest_name: guestName,
  };
}

function toRoomActivityDto({ id, type, at, title, status, ref_id, staff_name, action, details, performed_by }) {
  const atIso = at instanceof Date ? at.toISOString() : (at ? new Date(at).toISOString() : new Date().toISOString());
  return {
    id: String(id),
    type: type || 'STAY',
    at: atIso,
    time: atIso, // backward compatibility
    title: title || details || action || '',
    action: action || title || '', // backward compatibility
    status: status || '',
    ref_id: ref_id ? String(ref_id) : null,
    staff_name: staff_name || performed_by || '',
    performed_by: performed_by || staff_name || '',
    details: details || title || '',
  };
}

module.exports = {
  toManagerRoomDto,
  toRoomActivityDto,
};
