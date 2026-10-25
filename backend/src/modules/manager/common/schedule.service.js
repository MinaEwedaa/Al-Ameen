// Manager Module Shift Baseline Materialization Service (M6)
// Automatically generates baseline shift schedule rows from default_shift_type on demand

const { Staff, ShiftSchedule } = require('../../../db/models');
const { todayCairo, eachDate, shiftWindow } = require('../../../utils/time');
const { E } = require('../../../utils/errors');
const { DateTime } = require('luxon');
const { ZONE } = require('../../../utils/time');

/**
 * Ensures baseline ShiftSchedule rows exist for active receptionists.
 * @param {string} from - start date (yyyy-MM-dd)
 * @param {string} to - end date (yyyy-MM-dd)
 * @param {Array<string|ObjectId>} [staffIds] - optional subset of staff
 */
async function ensureBaseline(from, to, staffIds = null) {
  if (!from || !to) return;

  // Validate range: Cap at 62 days
  const fromDt = DateTime.fromISO(from, { zone: ZONE });
  const toDt = DateTime.fromISO(to, { zone: ZONE });
  if (toDt.diff(fromDt, 'days').days > 62) {
    throw E.validation('Date range exceeds maximum limit of 62 days', { field: 'range' });
  }

  const today = todayCairo();
  const start = from < today ? today : from;
  if (start > to) return;

  const staffQuery = {
    role: 'receptionist',
    active: true,
    default_shift_type: { $ne: null },
  };
  if (staffIds && staffIds.length > 0) {
    staffQuery._id = { $in: staffIds };
  }

  const staff = await Staff.find(staffQuery).select('default_shift_type').lean();
  if (staff.length === 0) return;

  const rows = await ShiftSchedule.find({
    staff_id: { $in: staff.map((s) => s._id) },
    shift_date: { $gte: start, $lte: to },
  })
    .select('staff_id shift_date')
    .lean();

  const have = new Set(rows.map((r) => `${String(r.staff_id)}|${r.shift_date}`));
  const ops = [];

  for (const d of eachDate(start, to)) {
    for (const s of staff) {
      if (have.has(`${String(s._id)}|${d}`)) continue;
      const win = shiftWindow(d, s.default_shift_type);
      ops.push({
        updateOne: {
          filter: {
            staff_id: s._id,
            shift_date: d,
            shift_type: s.default_shift_type.toLowerCase(),
          },
          update: {
            $setOnInsert: {
              start_at: win.start_at,
              end_at: win.end_at,
              status: 'SCHEDULED',
              created_by_staff_id: null,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length > 0) {
    try {
      await ShiftSchedule.bulkWrite(ops, { ordered: false });
    } catch (err) {
      // Ignore duplicate key race conditions handled by upsert
      if (!err.message?.includes('duplicate key')) {
        throw err;
      }
    }
  }
}

module.exports = {
  ensureBaseline,
};
