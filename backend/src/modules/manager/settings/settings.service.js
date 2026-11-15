const { Setting, Room, ShiftSchedule, Shift } = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { audit } = require('../../audit/audit.service');
const { sanitizeText } = require('../../../utils/arabic');
const {
  getShiftHours,
  setShiftHours,
  validateHours,
  todayCairo,
  shiftWindow,
} = require('../../../utils/time');

async function getHotelSettings() {
  const hotelDoc = await Setting.findOne({ key: 'hotel' }).lean();
  const totalRooms = await Room.countDocuments();

  const val = hotelDoc?.value || {};
  return {
    name: val.name || 'Al-Amin Hotel',
    location: val.location || '',
    floors_count: val.floors_count ?? val.count_floors ?? 1,
    total_rooms: totalRooms,
    updated_at: hotelDoc?.updatedAt ? hotelDoc.updatedAt.toISOString() : new Date().toISOString(),
  };
}

async function updateHotelSettings({ name, location, floors_count, staff, ip }) {
  if (name === undefined && location === undefined && floors_count === undefined) {
    throw E.validation('At least one field (name, location, floors_count) is required');
  }

  const update = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      throw E.validation('Name must be between 1 and 100 characters', 'VALIDATION_ERROR', {
        field: 'name',
      });
    }
    update['value.name'] = sanitizeText(name.trim());
  }

  if (location !== undefined) {
    if (typeof location !== 'string' || location.trim().length > 200) {
      throw E.validation('Location cannot exceed 200 characters', 'VALIDATION_ERROR', {
        field: 'location',
      });
    }
    update['value.location'] = sanitizeText(location.trim());
  }

  if (floors_count !== undefined) {
    const fc = Number(floors_count);
    if (!Number.isInteger(fc) || fc < 1 || fc > 100) {
      throw E.validation('Floors count must be an integer between 1 and 100', 'VALIDATION_ERROR', {
        field: 'floors_count',
      });
    }

    const highestRoom = await Room.findOne().sort({ floor: -1 }).select('floor').lean();
    const maxFloor = highestRoom?.floor || 1;
    if (fc < maxFloor) {
      throw E.validation(
        `Floors count cannot be lower than the highest room floor (${maxFloor})`,
        'VALIDATION_ERROR',
        {
          field: 'floors_count',
          issue: `>= highest room floor (${maxFloor})`,
        }
      );
    }
    update['value.floors_count'] = fc;
    update['value.count_floors'] = fc;
  }

  const before = await Setting.findOne({ key: 'hotel' }).lean();

  const updated = await Setting.findOneAndUpdate(
    { key: 'hotel' },
    { $set: update },
    { upsert: true, returnDocument: 'after' }
  );

  const totalRooms = await Room.countDocuments();

  await audit({
    action: 'UPDATED_HOTEL_SETTINGS',
    actorStaffId: staff._id,
    entity: 'Setting',
    entityId: String(updated._id),
    details: {
      before: before?.value,
      after: updated.value,
    },
    ip,
  });

  const val = updated.value || {};
  return {
    name: val.name || 'Al-Amin Hotel',
    location: val.location || '',
    floors_count: val.floors_count ?? val.count_floors ?? 1,
    total_rooms: totalRooms,
    updated_at: updated.updatedAt ? updated.updatedAt.toISOString() : new Date().toISOString(),
  };
}

async function getShiftSettings() {
  return getShiftHours();
}

async function updateShiftSettings({ morning, evening, night, apply_to_future = true, staff, ip }) {
  if (!morning && !evening && !night) {
    throw E.validation('At least one shift definition (morning, evening, night) is required');
  }

  const oldHours = getShiftHours();

  const merged = {
    morning: morning ? { ...oldHours.morning, ...morning } : { ...oldHours.morning },
    evening: evening ? { ...oldHours.evening, ...evening } : { ...oldHours.evening },
    night: night ? { ...oldHours.night, ...night } : { ...oldHours.night },
  };

  if (!validateHours(merged)) {
    throw E.validation(
      'Shift hours must follow each other with no gap or overlap and cover exactly 24 hours',
      'VALIDATION_ERROR'
    );
  }

  const before = await Setting.findOne({ key: 'shifts' }).lean();

  const updated = await Setting.findOneAndUpdate(
    { key: 'shifts' },
    { $set: { value: merged } },
    { upsert: true, returnDocument: 'after' }
  );

  setShiftHours(merged);

  let updatedFutureShifts = 0;
  if (apply_to_future !== false) {
    const now = new Date();
    const today = todayCairo();

    const scheduledRows = await ShiftSchedule.find({
      status: 'SCHEDULED',
      shift_date: { $gte: today },
      start_at: { $gt: now },
    }).lean();

    const realShifts = await Shift.find({
      shift_date: { $gte: today },
    })
      .select('staff_id shift_date shift_type')
      .lean();

    const realSet = new Set(
      realShifts.map((s) => `${s.staff_id}|${s.shift_date}|${(s.shift_type || '').toLowerCase()}`)
    );

    const ops = [];
    for (const row of scheduledRows) {
      const typeKey = (row.shift_type || '').toLowerCase();
      const key = `${row.staff_id}|${row.shift_date}|${typeKey}`;
      if (realSet.has(key)) continue;

      const oldWin = shiftWindow(row.shift_date, row.shift_type, oldHours);
      const rowStartMs = new Date(row.start_at).getTime();
      const rowEndMs = new Date(row.end_at).getTime();
      const oldStartMs = oldWin.start_at.getTime();
      const oldEndMs = oldWin.end_at.getTime();

      if (rowStartMs === oldStartMs && rowEndMs === oldEndMs) {
        const newWin = shiftWindow(row.shift_date, row.shift_type, merged);
        ops.push({
          updateOne: {
            filter: { _id: row._id },
            update: {
              $set: {
                start_at: newWin.start_at,
                end_at: newWin.end_at,
              },
            },
          },
        });
      }
    }

    if (ops.length > 0) {
      const bulkRes = await ShiftSchedule.bulkWrite(ops);
      updatedFutureShifts = bulkRes.modifiedCount || 0;
    }
  }

  await audit({
    action: 'UPDATED_SHIFT_SETTINGS',
    actorStaffId: staff._id,
    entity: 'Setting',
    entityId: String(updated._id),
    details: {
      before: before?.value,
      after: merged,
      updated_future_shifts: updatedFutureShifts,
    },
    ip,
  });

  return {
    ...merged,
    updated_future_shifts: updatedFutureShifts,
  };
}

module.exports = {
  getHotelSettings,
  updateHotelSettings,
  getShiftSettings,
  updateShiftSettings,
};
