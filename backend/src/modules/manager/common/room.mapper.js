// Room Physical and Occupancy Status Mapper for Manager Module (M5, M11)

const { Reservation } = require('../../../db/models');

const DB = {
  clean: 'available',
  dirty: 'cleaning',
  maintenance: 'maintenance',
  out: 'out_of_service',
};

const toPhysical = (r) => {
  if (r.status === DB.out) return 'OUT_OF_SERVICE';
  if (r.status === DB.maintenance) return 'MAINTENANCE';
  if (r.status === DB.dirty || r.status === 'cleaning' || r.status === 'dirty') return 'DIRTY';
  if (r.inspected) return 'INSPECTED';
  return 'CLEAN';
};

const fromPhysical = (p) => {
  const map = {
    CLEAN: { status: 'available', inspected: false },
    INSPECTED: { status: 'available', inspected: true },
    DIRTY: { status: 'cleaning', inspected: false },
    MAINTENANCE: { status: 'maintenance', inspected: false },
    OUT_OF_SERVICE: { status: 'out_of_service', inspected: false },
  };
  return map[p] || map.CLEAN;
};

/**
 * Computes live occupancy status and guest name for room IDs on today's Cairo date.
 */
async function occupancyMap(roomIds, today) {
  if (!roomIds || roomIds.length === 0) return new Map();

  const rs = await Reservation.find({
    room_id: { $in: roomIds },
    status: { $in: ['checked_in', 'confirmed'] },
  })
    .populate('guest_id', 'name')
    .lean();

  const map = new Map();
  for (const r of rs) {
    const guestName = r.guest_name || (r.guest_id ? r.guest_id.name : null);
    if (r.status === 'checked_in') {
      map.set(String(r.room_id), { occupancy: 'OCCUPIED', guest: guestName });
    } else if (r.status === 'confirmed' && !map.has(String(r.room_id))) {
      map.set(String(r.room_id), { occupancy: 'RESERVED', guest: null });
    }
  }
  return map;
}

module.exports = {
  DB,
  toPhysical,
  fromPhysical,
  occupancyMap,
};
