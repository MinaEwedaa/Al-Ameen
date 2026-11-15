const { Room, Staff, ShiftReport } = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { toPhysical, occupancyMap } = require('../common/room.mapper');
const { todayCairo } = require('../../../utils/time');
const { normalizeArabic } = require('../../../utils/arabic');
const { blindIndex, normalizeIdNumber } = require('../../../utils/crypto');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function globalSearch({ q, limit = 5 }) {
  const query = (q || '').trim();

  if (!query || query.length < 2) {
    throw E.validation('Search query must be at least 2 characters', 'VALIDATION_ERROR', {
      field: 'q',
    });
  }

  if (query.length > 50) {
    throw E.validation('Search query cannot exceed 50 characters', 'VALIDATION_ERROR', {
      field: 'q',
    });
  }

  const lim = Math.min(10, Math.max(1, parseInt(limit, 10) || 5));
  const is14Digits = /^\d{14}$/.test(query);
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(query);

  const [rooms, staff, shiftReports] = await Promise.all([
    // 1. Rooms search
    (async () => {
      const roomRegex = new RegExp(escapeRegex(query), 'i');
      const roomPrefixRegex = new RegExp(`^${escapeRegex(query)}`, 'i');

      const roomDocs = await Room.find({
        $or: [
          { room_number: roomPrefixRegex },
          { room_number: roomRegex },
          { room_type: roomRegex },
        ],
      })
        .sort({ room_number: 1 })
        .limit(lim)
        .lean();

      if (!roomDocs.length) return [];

      const occMap = await occupancyMap(
        roomDocs.map((r) => r._id),
        todayCairo()
      );

      return roomDocs.map((r) => ({
        id: String(r._id),
        room_number: r.room_number,
        floor: r.floor,
        room_type_name: r.room_type,
        physical_status: toPhysical(r),
        occupancy_status: occMap.get(String(r._id))?.occupancy || 'VACANT',
      }));
    })(),

    // 2. Staff search
    (async () => {
      if (is14Digits) {
        const hash = blindIndex(normalizeIdNumber(query));
        const s = await Staff.findOne({ id_number_hash: hash }).lean();
        if (!s) return [];
        return [
          {
            id: String(s._id),
            full_name: s.name,
            staff_type: (s.role || '').toUpperCase(),
            department: s.department || null,
            is_active: s.active !== false,
            national_id: s.id_number_last4 ? '******' + s.id_number_last4 : null,
          },
        ];
      }

      const normalized = normalizeArabic(query);
      const staffDocs = await Staff.find({
        $or: [
          { name_search: { $regex: escapeRegex(normalized), $options: 'i' } },
          { username: { $regex: `^${escapeRegex(query)}`, $options: 'i' } },
        ],
      })
        .sort({ name_search: 1 })
        .limit(lim)
        .lean();

      return staffDocs.map((s) => ({
        id: String(s._id),
        full_name: s.name,
        staff_type: (s.role || '').toUpperCase(),
        department: s.department || null,
        is_active: s.active !== false,
        national_id: s.id_number_last4 ? '******' + s.id_number_last4 : null,
      }));
    })(),

    // 3. Shift reports search
    (async () => {
      let filter;
      if (isDate) {
        filter = { shift_date: query };
      } else {
        filter = { staff_name: { $regex: escapeRegex(query), $options: 'i' } };
      }

      const reportDocs = await ShiftReport.find(filter)
        .sort({ shift_date: -1, createdAt: -1 })
        .limit(lim)
        .lean();

      return reportDocs.map((r) => ({
        report_id: String(r._id),
        business_date: r.shift_date,
        shift_type: (r.shift_type || '').toUpperCase(),
        staff_name: r.staff_name,
        review_status: r.review_status || 'PENDING_REVIEW',
      }));
    })(),
  ]);

  const displayQ = is14Digits ? '******' + query.slice(-4) : query;

  return {
    data: {
      rooms,
      staff,
      shift_reports: shiftReports,
    },
    meta: {
      q: displayQ,
      limit: lim,
    },
  };
}

module.exports = {
  globalSearch,
};
