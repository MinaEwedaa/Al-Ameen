const mongoose = require('mongoose');
const {
  Room,
  RoomNight,
  Reservation,
  Guest,
  RoomStatusHistory,
} = require('../../db/models');
const { E } = require('../../utils/errors');
const { stayDay, cairoDate, nightsBetween, stayDays } = require('../../utils/time');
const { sanitizeText } = require('../../utils/arabic');
const { paginate } = require('../../utils/paginate');
const { isObjectId } = require('../../utils/ids');
const { audit } = require('../audit/audit.service');
const { AUDIT } = require('../audit/audit.actions');
const { toRoomDto, toHistoryDto } = require('./room.dto');

// ما يقدر الموظف يختاره (reserved/occupied بيحطهم السيرفر بس)
const ALLOWED = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
  reserved: [],
  occupied: [],
};

const byRoomNumber = (a, b) =>
  String(a.room_number).localeCompare(String(b.room_number), 'en', { numeric: true });

async function findRoomOrThrow(roomId) {
  if (!isObjectId(roomId)) throw E.notFound('Room not found');
  const room = await Room.findById(roomId).lean();
  if (!room) throw E.notFound('Room not found');
  return room;
}

// الحالة الفعلية: reserved بتتحسب لو الغرفة available وعليها حجز confirmed ليوم الإقامة الحالي
async function deriveStatuses(rooms, now) {
  const day = stayDay(now);
  const nights = await RoomNight.find({ room_id: rooms.map((r) => r._id), day })
    .select('room_id reservation_id')
    .lean();

  const reservedRooms = new Set();
  if (nights.length) {
    const confirmed = await Reservation.find({
      _id: nights.map((n) => n.reservation_id),
      status: 'confirmed',
    })
      .select('_id')
      .lean();
    const confirmedIds = new Set(confirmed.map((r) => String(r._id)));
    for (const n of nights) {
      if (confirmedIds.has(String(n.reservation_id))) reservedRooms.add(String(n.room_id));
    }
  }

  const map = new Map();
  for (const r of rooms) {
    const id = String(r._id);
    map.set(id, r.status === 'available' && reservedRooms.has(id) ? 'reserved' : r.status);
  }
  return map;
}

async function currentGuestNames(rooms, statusMap) {
  const names = new Map();
  const occupiedIds = rooms
    .filter((r) => statusMap.get(String(r._id)) === 'occupied')
    .map((r) => r._id);
  if (!occupiedIds.length) return names;

  const resv = await Reservation.find({ room_id: occupiedIds, status: 'checked_in' })
    .select('room_id guest_id')
    .lean();
  const guests = await Guest.find({ _id: resv.map((r) => r.guest_id) })
    .select('name')
    .lean();
  const nameById = new Map(guests.map((g) => [String(g._id), g.name]));
  for (const r of resv) names.set(String(r.room_id), nameById.get(String(r.guest_id)) ?? null);
  return names;
}

async function toDtos(rooms, now) {
  const statusMap = await deriveStatuses(rooms, now);
  const names = await currentGuestNames(rooms, statusMap);
  return rooms
    .slice()
    .sort(byRoomNumber)
    .map((r) =>
      toRoomDto(r, {
        status: statusMap.get(String(r._id)),
        guestName: names.get(String(r._id)) ?? null,
      })
    );
}

async function listRooms({ status, room_type, page, limit }, now) {
  const filter = {};
  if (room_type) filter.room_type = String(room_type);
  const rooms = await Room.find(filter).lean();
  let dtos = await toDtos(rooms, now);
  if (status) dtos = dtos.filter((d) => d.status === status);

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return {
    data: dtos.slice((p - 1) * l, p * l),
    meta: { page: p, limit: l, total: dtos.length },
  };
}

async function getRoom(roomId, now) {
  const room = await findRoomOrThrow(roomId);
  const [dto] = await toDtos([room], now);
  return dto;
}

async function checkAvailability({ check_in, check_out, room_type }, now) {
  const inDate = new Date(check_in);
  const outDate = new Date(check_out);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) {
    throw E.validation('check_in and check_out must be valid dates');
  }
  const inDay = cairoDate(inDate);
  const outDay = cairoDate(outDate);
  const nights = nightsBetween(inDay, outDay);
  if (nights < 1) throw E.validation('check_out must be at least one day after check_in');

  // يوم الخروج مش بيتحسب: حجز تاني ممكن يبدأ فيه
  const bookedRoomIds = await RoomNight.distinct('room_id', { day: { $in: stayDays(inDay, nights) } });

  const filter = { _id: { $nin: bookedRoomIds }, status: { $ne: 'maintenance' } };
  if (room_type) filter.room_type = String(room_type);
  const rooms = await Room.find(filter).lean();
  return { data: await toDtos(rooms, now) };
}

async function changeStatus({ roomId, status, notes, staff, shift, ip, now }) {
  const room = await findRoomOrThrow(roomId);
  const statusMap = await deriveStatuses([room], now);
  const current = statusMap.get(String(room._id));

  if (!(ALLOWED[current] || []).includes(status)) {
    throw E.conflict(
      `Cannot change room status from ${current} to ${status}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  let history;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // تحديث شرطي: لو حد غيّر الحالة في نفس اللحظة، modifiedCount مش هيبقى 1
      const upd = await Room.updateOne(
        { _id: room._id, status: room.status },
        { $set: { status } },
        { session }
      );
      if (upd.modifiedCount !== 1) {
        throw E.conflict('Room status was changed by someone else. Please reload.');
      }

      const [h] = await RoomStatusHistory.create(
        [
          {
            room_id: room._id,
            shift_id: shift._id,
            staff_id: staff._id,
            status,
            notes: sanitizeText(notes || ''),
            changed_at: now,
          },
        ],
        { session }
      );
      history = h;

      await audit(
        {
          action: AUDIT.ROOM_STATUS_CHANGED,
          actorStaffId: staff._id,
          entity: 'Room',
          entityId: String(room._id),
          details: { from: current, to: status },
          ip,
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  return toHistoryDto(history);
}

async function getStatusHistory(roomId, { page, limit }) {
  const room = await findRoomOrThrow(roomId);
  return paginate(
    RoomStatusHistory,
    { room_id: room._id },
    { page, limit, sort: { changed_at: -1 } },
    toHistoryDto
  );
}

module.exports = {
  deriveStatuses,
  listRooms,
  getRoom,
  checkAvailability,
  changeStatus,
  getStatusHistory,
};