// Manager Rooms Service (M5)

const mongoose = require('mongoose');
const {
  Room,
  RoomType,
  Reservation,
  CleaningTask,
  MaintenanceIssue,
} = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { cairoDate } = require('../../../utils/time');
const { toPiastres } = require('../../../utils/money');
const { audit } = require('../../audit/audit.service');
const { toPhysical, fromPhysical, occupancyMap } = require('../common/room.mapper');
const { toManagerRoomDto, toRoomActivityDto } = require('./rooms.dto');

async function listRooms({ page = 1, limit = 100, floor, room_type_id, physical_status, occupancy_status, q }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(200, Math.max(1, Number(limit) || 100));
  const today = cairoDate();

  const filter = {};
  if (floor !== undefined && floor !== '') {
    filter.floor = Number(floor);
  }
  if (room_type_id) {
    if (mongoose.isValidObjectId(room_type_id)) {
      filter.room_type_id = room_type_id;
    }
  }
  if (q && q.trim()) {
    filter.room_number = { $regex: q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  if (physical_status) {
    const phys = fromPhysical(physical_status.toUpperCase());
    filter.status = phys.status;
    if (phys.inspected !== undefined) {
      filter.inspected = phys.inspected;
    }
  }

  const allRooms = await Room.find(filter)
    .populate('room_type_id', 'name')
    .sort({ room_number: 1 })
    .lean();

  const roomIds = allRooms.map((r) => r._id);
  const occMap = await occupancyMap(roomIds, today);

  let filteredRooms = allRooms.map((r) => {
    const occInfo = occMap.get(String(r._id)) || { occupancy: 'VACANT', guest: null };
    const phys = toPhysical(r);
    return {
      room: r,
      occupancyStatus: occInfo.occupancy,
      physicalStatus: phys,
      guestName: occInfo.guest,
    };
  });

  if (occupancy_status) {
    const targetOcc = occupancy_status.toUpperCase();
    filteredRooms = filteredRooms.filter((item) => item.occupancyStatus === targetOcc);
  }

  const total = filteredRooms.length;
  const paged = filteredRooms.slice((p - 1) * l, p * l);

  const data = paged.map(({ room, occupancyStatus, physicalStatus, guestName }) =>
    toManagerRoomDto(room, { occupancyStatus, physicalStatus, guestName })
  );

  return {
    data,
    meta: {
      page: p,
      limit: l,
      total,
      total_pages: Math.ceil(total / l) || 1,
    },
  };
}

async function updateRoom(roomId, { price_per_night, floor, room_type_id, physical_status }, actorStaff, ip) {
  if (!mongoose.isValidObjectId(roomId)) throw E.notFound('Room not found');
  const room = await Room.findById(roomId);
  if (!room) throw E.notFound('Room not found');

  const today = cairoDate();
  const occMap = await occupancyMap([room._id], today);
  const occInfo = occMap.get(String(room._id)) || { occupancy: 'VACANT', guest: null };

  const updates = {};
  const before = {
    price_per_night: room.price_per_night,
    floor: room.floor,
    room_type_id: room.room_type_id,
    status: room.status,
    inspected: room.inspected,
  };

  if (price_per_night !== undefined) {
    const numPrice = Number(price_per_night);
    if (isNaN(numPrice) || numPrice < 0) {
      throw E.validation('price_per_night must be a valid positive number', { field: 'price_per_night' });
    }
    updates.price_per_night = toPiastres(numPrice);
  }

  if (floor !== undefined) {
    const numFloor = Number(floor);
    if (isNaN(numFloor) || numFloor < 0) {
      throw E.validation('floor must be a valid non-negative integer', { field: 'floor' });
    }
    updates.floor = Math.floor(numFloor);
  }

  if (room_type_id !== undefined) {
    if (!mongoose.isValidObjectId(room_type_id)) {
      throw E.validation('Invalid room_type_id', { field: 'room_type_id' });
    }
    const typeDoc = await RoomType.findById(room_type_id).lean();
    if (!typeDoc || !typeDoc.is_active) {
      throw E.validation('Room type not found or inactive', { field: 'room_type_id' });
    }
    updates.room_type_id = typeDoc._id;
    updates.room_type = typeDoc.name;
  }

  let upcomingReservations = 0;
  if (physical_status !== undefined) {
    // Check if room is currently occupied
    if (occInfo.occupancy === 'OCCUPIED') {
      throw E.conflict('The manager cannot change the status of an occupied room', 'CONFLICT');
    }

    const mapped = fromPhysical(physical_status.toUpperCase());
    updates.status = mapped.status;
    updates.inspected = mapped.inspected;

    if (mapped.status === 'maintenance' || mapped.status === 'out_of_service') {
      upcomingReservations = await Reservation.countDocuments({
        room_id: room._id,
        status: 'confirmed',
        check_in_date: { $gte: today },
      });
    }
  }

  if (Object.keys(updates).length === 0) {
    throw E.validation('At least one field is required to update');
  }

  Object.assign(room, updates);
  await room.save();

  await audit({
    action: 'UPDATED_ROOM',
    actorStaffId: actorStaff._id,
    entity: 'Room',
    entityId: roomId,
    details: { before, after: updates },
    ip,
  });

  const updatedOccMap = await occupancyMap([room._id], today);
  const updatedOcc = updatedOccMap.get(String(room._id)) || { occupancy: 'VACANT', guest: null };

  const dto = toManagerRoomDto(room.toObject(), {
    occupancyStatus: updatedOcc.occupancy,
    physicalStatus: toPhysical(room),
    guestName: updatedOcc.guest,
  });

  if (upcomingReservations > 0) {
    dto.upcoming_reservations = upcomingReservations;
  }

  return { data: dto };
}

async function getRoomActivities(roomId, { page = 1, limit = 20 } = {}) {
  if (!mongoose.isValidObjectId(roomId)) throw E.notFound('Room not found');
  const room = await Room.findById(roomId).lean();
  if (!room) throw E.notFound('Room not found');

  const p = Math.max(1, Number(page) || 1);
  const n = Math.min(50, Math.max(1, Number(limit) || 20));
  const fetchLimit = p * n;

  // Fetch up to p*n of each source
  const [cleaningTasks, maintenanceIssues, reservations, cleanCount, maintCount, resCount] =
    await Promise.all([
      CleaningTask.find({ room_id: roomId })
        .populate('assigned_to_staff_id', 'name')
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean(),
      MaintenanceIssue.find({ room_id: roomId })
        .populate('staff_id', 'name')
        .sort({ created_at: -1 })
        .limit(fetchLimit)
        .lean(),
      Reservation.find({ room_id: roomId })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean(),
      CleaningTask.countDocuments({ room_id: roomId }),
      MaintenanceIssue.countDocuments({ room_id: roomId }),
      Reservation.countDocuments({ room_id: roomId }),
    ]);

  const items = [];

  for (const c of cleaningTasks) {
    items.push({
      id: String(c._id),
      type: 'CLEANING',
      at: c.finished_at || c.createdAt,
      title: `تنظيف الغرفة - ${c.status === 'done' ? 'مكتمل' : 'معلق'}`,
      status: c.status.toUpperCase(),
      ref_id: c._id,
      staff_name: c.cleaner_name || c.assigned_to_staff_id?.name || null,
    });
  }

  for (const m of maintenanceIssues) {
    items.push({
      id: String(m._id),
      type: 'MAINTENANCE',
      at: m.resolved_at || m.created_at || m.createdAt,
      title: m.problem,
      status: m.status.toUpperCase(),
      ref_id: m._id,
      staff_name: m.staff_id?.name || null,
    });
  }

  for (const r of reservations) {
    items.push({
      id: String(r._id),
      type: 'STAY',
      at: r.check_in_datetime || r.createdAt,
      title: `إقامة النزيل ${r.guest_name || ''}`,
      status: r.status.toUpperCase(),
      ref_id: r._id,
      staff_name: null,
    });
  }

  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  const total = cleanCount + maintCount + resCount;
  const pagedItems = items.slice((p - 1) * n, p * n).map(toRoomActivityDto);

  return {
    data: pagedItems,
    meta: {
      page: p,
      limit: n,
      total,
      total_pages: Math.ceil(total / n) || 1,
    },
  };
}

module.exports = {
  listRooms,
  updateRoom,
  getRoomActivities,
};
