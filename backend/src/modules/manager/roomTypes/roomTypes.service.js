// Manager Room Types Service (M5)

const mongoose = require('mongoose');
const { RoomType, Room } = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { toPiastres, toEgp } = require('../../../utils/money');
const { sanitizeText } = require('../../../utils/arabic');
const { audit } = require('../../audit/audit.service');
const { runInTransaction } = require('../../../utils/transaction');

function toRoomTypeDto(type, agg = {}) {
  const roomsCount = agg.rooms_count || 0;
  return {
    id: String(type._id),
    name: type.name,
    description: type.description || '',
    base_price: toEgp(type.base_price),
    capacity: type.capacity,
    amenities: type.amenities || [],
    rooms_count: roomsCount,
    price_min: roomsCount > 0 ? toEgp(agg.price_min) : toEgp(type.base_price),
    price_max: roomsCount > 0 ? toEgp(agg.price_max) : toEgp(type.base_price),
    is_active: type.is_active !== false,
  };
}

async function listRoomTypes() {
  const [types, stats] = await Promise.all([
    RoomType.find().sort({ name: 1 }).lean(),
    Room.aggregate([
      {
        $group: {
          _id: '$room_type_id',
          rooms_count: { $sum: 1 },
          price_min: { $min: '$price_per_night' },
          price_max: { $max: '$price_per_night' },
        },
      },
    ]),
  ]);

  const statsMap = new Map();
  for (const s of stats) {
    if (s._id) statsMap.set(String(s._id), s);
  }

  const data = types.map((t) => toRoomTypeDto(t, statsMap.get(String(t._id))));
  return { data };
}

async function getRoomType(id) {
  if (!mongoose.isValidObjectId(id)) throw E.notFound('Room type not found');
  const type = await RoomType.findById(id).lean();
  if (!type) throw E.notFound('Room type not found');

  const [agg] = await Room.aggregate([
    { $match: { room_type_id: type._id } },
    {
      $group: {
        _id: '$room_type_id',
        rooms_count: { $sum: 1 },
        price_min: { $min: '$price_per_night' },
        price_max: { $max: '$price_per_night' },
      },
    },
  ]);

  return { data: toRoomTypeDto(type, agg) };
}

async function createRoomType({ name, base_price, capacity, description, amenities }, actorStaff, ip) {
  if (!name || !name.trim()) throw E.validation('name is required', { field: 'name' });
  const cleanName = sanitizeText(name);

  const numPrice = Number(base_price);
  if (isNaN(numPrice) || numPrice <= 0) {
    throw E.validation('base_price must be greater than 0', { field: 'base_price' });
  }

  const numCapacity = Number(capacity);
  if (isNaN(numCapacity) || numCapacity < 1) {
    throw E.validation('capacity must be at least 1', { field: 'capacity' });
  }

  const existing = await RoomType.findOne({ name: cleanName }).lean();
  if (existing) {
    throw E.conflict('Room type with this name already exists', 'NAME_ALREADY_EXISTS', { field: 'name' });
  }

  let cleanAmenities = [];
  if (Array.isArray(amenities)) {
    const set = new Set();
    for (const a of amenities.slice(0, 30)) {
      if (typeof a === 'string' && a.trim()) set.add(a.trim());
    }
    cleanAmenities = Array.from(set);
  }

  const type = await RoomType.create({
    name: cleanName,
    base_price: toPiastres(numPrice),
    capacity: Math.floor(numCapacity),
    description: description ? sanitizeText(description) : '',
    amenities: cleanAmenities,
    is_active: true,
  });

  await audit({
    action: 'CREATED_ROOM_TYPE',
    actorStaffId: actorStaff._id,
    entity: 'RoomType',
    entityId: String(type._id),
    details: { name: cleanName, base_price: numPrice },
    ip,
  });

  return { data: toRoomTypeDto(type.toObject(), { rooms_count: 0, price_min: type.base_price, price_max: type.base_price }) };
}

async function updateRoomType(id, { name, base_price, capacity, description, amenities, is_active }, actorStaff, ip) {
  if (!mongoose.isValidObjectId(id)) throw E.notFound('Room type not found');
  const type = await RoomType.findById(id);
  if (!type) throw E.notFound('Room type not found');

  const updates = {};
  let renameNeeded = false;
  let oldName = type.name;

  if (name !== undefined) {
    if (!name.trim()) throw E.validation('name cannot be empty', { field: 'name' });
    const cleanName = sanitizeText(name);
    if (cleanName !== type.name) {
      const existing = await RoomType.findOne({ name: cleanName, _id: { $ne: type._id } }).lean();
      if (existing) {
        throw E.conflict('Room type with this name already exists', 'NAME_ALREADY_EXISTS', { field: 'name' });
      }
      updates.name = cleanName;
      renameNeeded = true;
    }
  }

  if (base_price !== undefined) {
    const numPrice = Number(base_price);
    if (isNaN(numPrice) || numPrice <= 0) {
      throw E.validation('base_price must be greater than 0', { field: 'base_price' });
    }
    updates.base_price = toPiastres(numPrice);
  }

  if (capacity !== undefined) {
    const numCapacity = Number(capacity);
    if (isNaN(numCapacity) || numCapacity < 1) {
      throw E.validation('capacity must be at least 1', { field: 'capacity' });
    }
    updates.capacity = Math.floor(numCapacity);
  }

  if (description !== undefined) {
    updates.description = description ? sanitizeText(description) : '';
  }

  if (amenities !== undefined) {
    if (Array.isArray(amenities)) {
      const set = new Set();
      for (const a of amenities.slice(0, 30)) {
        if (typeof a === 'string' && a.trim()) set.add(a.trim());
      }
      updates.amenities = Array.from(set);
    }
  }

  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
  }

  if (Object.keys(updates).length === 0) {
    throw E.validation('At least one field is required to update');
  }

  await runInTransaction(async (session) => {
    Object.assign(type, updates);
    await type.save({ session });

    if (renameNeeded) {
      // Sync Room.room_type string on every room of that type in the same transaction
      await Room.updateMany(
        { room_type_id: type._id },
        { $set: { room_type: updates.name } },
        { session }
      );
    }
  });

  await audit({
    action: 'UPDATED_ROOM_TYPE',
    actorStaffId: actorStaff._id,
    entity: 'RoomType',
    entityId: id,
    details: { before: { name: oldName }, after: updates },
    ip,
  });

  return getRoomType(id);
}

module.exports = {
  listRoomTypes,
  getRoomType,
  createRoomType,
  updateRoomType,
};
