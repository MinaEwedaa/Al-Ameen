// Manager Shifts Service (M6)
// Implements complete shift scheduling, baseline materialization, overview, roster, and force-close

const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const {
  Shift,
  ShiftSchedule,
  Staff,
  LeaveRequest,
  Session,
} = require('../../../db/models');
const {
  ZONE,
  todayCairo,
  eachDate,
  shiftWindow,
} = require('../../../utils/time');
const { E } = require('../../../utils/errors');
const { audit } = require('../../audit/audit.service');
const { runInTransaction } = require('../../../utils/transaction');
const { ensureBaseline } = require('../common/schedule.service');
const { deriveStatus, toShiftDto } = require('./shifts.dto');
const { isOpenShift } = require('../common/shift.mapper');

const SHIFT_TYPES = ['morning', 'evening', 'night'];
const WEEK_START = 6; // Saturday (Egyptian week)

// ─── 1. GET /shifts ──────────────────────────────────────────────────────────

async function listShifts({ business_date, from, to, staff_id, shift_type, page = 1, limit = 20 }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  let start = from;
  let end = to;
  if (!start && !end) {
    start = business_date || todayCairo();
    end = start;
  } else if (!start) {
    start = todayCairo();
  } else if (!end) {
    end = start;
  }

  // Materialize baseline on demand for active receptionists in range
  await ensureBaseline(start, end, staff_id ? [staff_id] : null);

  const filter = {
    shift_date: { $gte: start, $lte: end },
  };

  if (staff_id) {
    if (!mongoose.isValidObjectId(staff_id)) throw E.validation('Invalid staff_id');
    filter.staff_id = staff_id;
  }

  if (shift_type) {
    filter.shift_type = shift_type.toLowerCase();
  }

  const total = await ShiftSchedule.countDocuments(filter);
  const rows = await ShiftSchedule.find(filter)
    .sort({ start_at: 1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  if (rows.length === 0) {
    return { data: [], meta: { page: p, limit: l, total: 0, total_pages: 1 } };
  }

  // Batch query staff and actual shifts
  const staffIds = [...new Set(rows.map((r) => String(r.staff_id)))];
  const shiftDates = [...new Set(rows.map((r) => r.shift_date))];

  const [staffList, actualShifts] = await Promise.all([
    Staff.find({ _id: { $in: staffIds } }).select('name role department').lean(),
    Shift.find({ staff_id: { $in: staffIds }, shift_date: { $in: shiftDates } }).lean(),
  ]);

  const staffMap = new Map(staffList.map((s) => [String(s._id), s]));
  const actualMap = new Map(actualShifts.map((a) => [`${String(a.staff_id)}|${a.shift_date}|${a.shift_type}`, a]));

  const data = rows.map((r) => {
    const s = staffMap.get(String(r.staff_id));
    const actual = actualMap.get(`${String(r.staff_id)}|${r.shift_date}|${r.shift_type}`);
    return toShiftDto(r, actual, s);
  });

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

// ─── 2. GET /shifts/overview ────────────────────────────────────────────────

async function getShiftOverview(businessDate) {
  const dateStr = businessDate || todayCairo();

  await ensureBaseline(dateStr, dateStr);

  const [schedules, actualShifts] = await Promise.all([
    ShiftSchedule.find({ shift_date: dateStr }).populate('staff_id', 'name department role').lean(),
    Shift.find({ shift_date: dateStr }).lean(),
  ]);

  const actualMap = new Map(actualShifts.map((a) => [`${String(a.staff_id)}|${a.shift_type}`, a]));

  const cards = [];
  const totals = { scheduled: 0, active: 0, completed: 0, cancelled: 0 };

  for (const type of ['MORNING', 'EVENING', 'NIGHT']) {
    const lowerType = type.toLowerCase();
    const win = shiftWindow(dateStr, lowerType);

    const typeSchedules = schedules.filter((s) => s.shift_type === lowerType);

    const counts = { scheduled: 0, active: 0, completed: 0, cancelled: 0 };
    const staffItems = [];

    for (const row of typeSchedules) {
      const actual = actualMap.get(`${String(row.staff_id._id || row.staff_id)}|${lowerType}`);
      const status = deriveStatus(row, actual);
      const statusKey = status.toLowerCase();
      if (counts[statusKey] !== undefined) {
        counts[statusKey]++;
        totals[statusKey]++;
      }

      if (staffItems.length < 10) {
        staffItems.push({
          staff_id: String(row.staff_id._id || row.staff_id),
          staff_name: row.staff_id?.name || 'Staff',
          department: row.staff_id?.department || null,
          status,
        });
      }
    }

    const nonCancelledStaffCount = counts.scheduled + counts.active + counts.completed;
    const coverage = nonCancelledStaffCount > 0 ? 'COVERED' : 'UNCOVERED';

    cards.push({
      shift_type: type,
      start_at: win.start_at.toISOString(),
      end_at: win.end_at.toISOString(),
      counts,
      coverage,
      staff: staffItems,
    });
  }

  return {
    business_date: dateStr,
    cards,
    totals,
  };
}

// ─── 3. GET /shifts/roster ──────────────────────────────────────────────────

async function getShiftRoster({ view = 'week', date, department, staff_type }) {
  const curDateStr = date || todayCairo();
  const cur = DateTime.fromISO(curDateStr, { zone: ZONE });

  let from, to;
  if (view === 'month') {
    from = cur.startOf('month').toFormat('yyyy-MM-dd');
    to = cur.endOf('month').toFormat('yyyy-MM-dd');
  } else {
    // Egyptian week starts on Saturday (WEEK_START = 6)
    const diffToSaturday = (cur.weekday % 7 + 1) % 7;
    const saturday = cur.minus({ days: diffToSaturday });
    const friday = saturday.plus({ days: 6 });
    from = saturday.toFormat('yyyy-MM-dd');
    to = friday.toFormat('yyyy-MM-dd');
  }

  await ensureBaseline(from, to);

  const staffFilter = { active: true };
  if (department) staffFilter.department = department;
  if (staff_type) staffFilter.role = staff_type.toLowerCase();

  const staffCount = await Staff.countDocuments(staffFilter);
  if (staffCount > 200) {
    throw E.badRequest('Roster query exceeds 200 staff members. Please filter by department.');
  }

  const staffList = await Staff.find(staffFilter).select('name department role').lean();
  const staffIds = staffList.map((s) => s._id);

  const [schedules, approvedLeaves] = await Promise.all([
    ShiftSchedule.find({
      staff_id: { $in: staffIds },
      shift_date: { $gte: from, $lte: to },
    }).lean(),
    LeaveRequest.find({
      staff_id: { $in: staffIds },
      status: 'APPROVED',
      start_date: { $lte: to },
      end_date: { $gte: from },
    }).lean(),
  ]);

  const days = eachDate(from, to);

  // Group schedules by staff_id -> date -> [ { shift_id, shift_type, status } ]
  const schedByStaff = new Map();
  for (const s of schedules) {
    const sid = String(s.staff_id);
    if (!schedByStaff.has(sid)) schedByStaff.set(sid, new Map());
    const dateMap = schedByStaff.get(sid);
    if (!dateMap.has(s.shift_date)) dateMap.set(s.shift_date, []);
    dateMap.get(s.shift_date).push({
      shift_id: String(s._id),
      shift_type: s.shift_type.toUpperCase(),
      status: s.status, // planned status (SCHEDULED or CANCELLED)
    });
  }

  // Group approved leaves by staff_id -> [ dates in range ]
  const leaveByStaff = new Map();
  for (const l of approvedLeaves) {
    const sid = String(l.staff_id);
    if (!leaveByStaff.has(sid)) leaveByStaff.set(sid, new Set());
    const lSet = leaveByStaff.get(sid);
    for (const d of days) {
      if (d >= l.start_date && d <= l.end_date) {
        lSet.add(d);
      }
    }
  }

  const rows = staffList.map((st) => {
    const sid = String(st._id);
    const dateMap = schedByStaff.get(sid) || new Map();
    const cells = {};
    for (const d of days) {
      cells[d] = dateMap.get(d) || [];
    }
    const leaveSet = leaveByStaff.get(sid) || new Set();

    return {
      staff_id: sid,
      staff_name: st.name,
      department: st.department || null,
      staff_type: st.role.toUpperCase(),
      cells,
      leave_dates: Array.from(leaveSet).sort(),
    };
  });

  // Coverage grouped by department
  const depts = [...new Set(staffList.map((s) => s.department || 'General'))];
  const coverage = depts.map((dName) => {
    const by_date = {};
    for (const d of days) {
      by_date[d] = { MORNING: 0, EVENING: 0, NIGHT: 0 };
    }
    for (const st of staffList) {
      if ((st.department || 'General') !== dName) continue;
      const sid = String(st._id);
      const dateMap = schedByStaff.get(sid) || new Map();
      for (const d of days) {
        const dayScheds = dateMap.get(d) || [];
        for (const item of dayScheds) {
          if (item.status === 'SCHEDULED' && by_date[d][item.shift_type] !== undefined) {
            by_date[d][item.shift_type]++;
          }
        }
      }
    }
    return {
      department: dName,
      by_date,
    };
  });

  return {
    view,
    from,
    to,
    days,
    rows,
    coverage,
  };
}

// ─── 4. POST /shifts ────────────────────────────────────────────────────────

async function createShift({ staff_id, business_date, shift_date, shift_type, start_at, end_at }, actorStaff, ip) {
  const staffId = staff_id;
  const targetDate = business_date || shift_date;

  if (!staffId || !mongoose.isValidObjectId(staffId)) {
    throw E.validation('Valid staff_id is required', { field: 'staff_id' });
  }
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw E.validation('Valid business_date (YYYY-MM-DD) is required', { field: 'business_date' });
  }
  if (!shift_type) {
    throw E.validation('shift_type is required', { field: 'shift_type' });
  }

  const normalizedType = shift_type.toLowerCase();
  if (!SHIFT_TYPES.includes(normalizedType)) {
    throw E.validation('Invalid shift_type. Must be MORNING, EVENING, or NIGHT', { field: 'shift_type' });
  }

  const staff = await Staff.findById(staffId).lean();
  if (!staff) throw E.notFound('Staff not found');
  if (!staff.active) {
    throw E.badRequest('Cannot schedule an inactive staff member');
  }

  // Windows calculation
  const defaultWin = shiftWindow(targetDate, normalizedType);
  const finalStartAt = start_at ? new Date(start_at) : defaultWin.start_at;
  const finalEndAt = end_at ? new Date(end_at) : defaultWin.end_at;

  const now = new Date();
  if (finalEndAt <= finalStartAt) {
    throw E.badRequest('end_at must be later than start_at');
  }
  if (finalEndAt <= now) {
    throw E.badRequest('end_at must be in the future');
  }
  const durationHours = (finalEndAt.getTime() - finalStartAt.getTime()) / 3600e3;
  if (durationHours > 16) {
    throw E.badRequest('Shift duration cannot exceed 16 hours');
  }

  // Check approved leave covering date
  const leave = await LeaveRequest.findOne({
    staff_id: staffId,
    status: 'APPROVED',
    start_date: { $lte: targetDate },
    end_date: { $gte: targetDate },
  }).lean();
  if (leave) {
    throw E.conflict('Staff member has approved leave on this date', 'CONFLICT');
  }

  // Check overlap with another SCHEDULED row of the same person
  const overlap = await ShiftSchedule.findOne({
    staff_id: staffId,
    status: 'SCHEDULED',
    start_at: { $lt: finalEndAt },
    end_at: { $gt: finalStartAt },
  }).lean();
  if (overlap) {
    throw E.conflict('Shift overlaps with an existing scheduled shift', 'SHIFT_OVERLAP', {
      conflicting_shift_id: String(overlap._id),
    });
  }

  // If a CANCELLED row already exists for same staff, date and type, reactivate it
  let schedule = await ShiftSchedule.findOne({
    staff_id: staffId,
    shift_date: targetDate,
    shift_type: normalizedType,
  });

  if (schedule) {
    if (schedule.status === 'SCHEDULED') {
      throw E.conflict('Shift already scheduled for this slot', 'SHIFT_OVERLAP');
    }
    // Reactivate cancelled row
    schedule.status = 'SCHEDULED';
    schedule.start_at = finalStartAt;
    schedule.end_at = finalEndAt;
    schedule.cancel_reason = null;
    schedule.created_by_staff_id = actorStaff._id;
    await schedule.save();
  } else {
    schedule = await ShiftSchedule.create({
      staff_id: staffId,
      shift_date: targetDate,
      shift_type: normalizedType,
      start_at: finalStartAt,
      end_at: finalEndAt,
      status: 'SCHEDULED',
      created_by_staff_id: actorStaff._id,
    });
  }

  await audit({
    action: 'CREATED_SHIFT',
    actorStaffId: actorStaff._id,
    entity: 'ShiftSchedule',
    entityId: String(schedule._id),
    details: { staff_id: staffId, shift_date: targetDate, shift_type: normalizedType },
    ip,
  });

  return toShiftDto(schedule, null, staff);
}

// ─── 5. PATCH /shifts/:id ───────────────────────────────────────────────────

async function updateShift(shiftId, payload, actorStaff, ip) {
  if (!mongoose.isValidObjectId(shiftId)) throw E.notFound('Shift not found');
  const schedule = await ShiftSchedule.findById(shiftId);
  if (!schedule) throw E.notFound('Shift not found');

  const actual = await Shift.findOne({
    staff_id: schedule.staff_id,
    shift_date: schedule.shift_date,
    shift_type: schedule.shift_type,
  }).lean();

  const derived = deriveStatus(schedule, actual);
  const now = new Date();
  if (derived !== 'SCHEDULED' || schedule.start_at <= now) {
    throw E.conflict('Cannot modify shift that has already started or completed', 'SHIFT_ALREADY_STARTED');
  }

  const { staff_id, business_date, shift_date, shift_type, start_at, end_at } = payload;
  const targetStaffId = staff_id || schedule.staff_id;
  const targetDate = business_date || shift_date || schedule.shift_date;
  const targetType = shift_type ? shift_type.toLowerCase() : schedule.shift_type;

  if (!SHIFT_TYPES.includes(targetType)) {
    throw E.validation('Invalid shift_type');
  }

  // Windows calculation
  const defaultWin = shiftWindow(targetDate, targetType);
  const finalStartAt = start_at ? new Date(start_at) : (payload.start_at ? new Date(payload.start_at) : defaultWin.start_at);
  const finalEndAt = end_at ? new Date(end_at) : (payload.end_at ? new Date(payload.end_at) : defaultWin.end_at);

  if (finalEndAt <= finalStartAt) {
    throw E.badRequest('end_at must be later than start_at');
  }
  if (finalEndAt <= now) {
    throw E.badRequest('end_at must be in the future');
  }
  if ((finalEndAt.getTime() - finalStartAt.getTime()) / 3600e3 > 16) {
    throw E.badRequest('Shift duration cannot exceed 16 hours');
  }

  // Overlap check excluding self
  const overlap = await ShiftSchedule.findOne({
    _id: { $ne: schedule._id },
    staff_id: targetStaffId,
    status: 'SCHEDULED',
    start_at: { $lt: finalEndAt },
    end_at: { $gt: finalStartAt },
  }).lean();
  if (overlap) {
    throw E.conflict('Shift overlaps with an existing scheduled shift', 'SHIFT_OVERLAP');
  }

  // Moving onto key that holds CANCELLED row check
  if (String(targetStaffId) !== String(schedule.staff_id) || targetDate !== schedule.shift_date || targetType !== schedule.shift_type) {
    const existingCancelled = await ShiftSchedule.findOne({
      _id: { $ne: schedule._id },
      staff_id: targetStaffId,
      shift_date: targetDate,
      shift_type: targetType,
      status: 'CANCELLED',
    }).lean();
    if (existingCancelled) {
      throw E.conflict('Slot has a cancelled shift. Re-create it with POST /shifts', 'CONFLICT');
    }
  }

  schedule.staff_id = targetStaffId;
  schedule.shift_date = targetDate;
  schedule.shift_type = targetType;
  schedule.start_at = finalStartAt;
  schedule.end_at = finalEndAt;
  await schedule.save();

  await audit({
    action: 'UPDATED_SHIFT',
    actorStaffId: actorStaff._id,
    entity: 'ShiftSchedule',
    entityId: String(schedule._id),
    details: { staff_id: targetStaffId, shift_date: targetDate, shift_type: targetType },
    ip,
  });

  const staff = await Staff.findById(targetStaffId).lean();
  return toShiftDto(schedule, actual, staff);
}

// ─── 6. DELETE /shifts/:id ──────────────────────────────────────────────────

async function deleteShift(shiftId, { reason = 'MANUAL' } = {}, actorStaff, ip) {
  if (!mongoose.isValidObjectId(shiftId)) throw E.notFound('Shift not found');
  const schedule = await ShiftSchedule.findById(shiftId);
  if (!schedule) throw E.notFound('Shift not found');

  const actual = await Shift.findOne({
    staff_id: schedule.staff_id,
    shift_date: schedule.shift_date,
    shift_type: schedule.shift_type,
  }).lean();

  const derived = deriveStatus(schedule, actual);
  const now = new Date();
  if (derived !== 'SCHEDULED' || schedule.start_at <= now) {
    throw E.conflict('Cannot cancel shift that has already started or completed', 'SHIFT_ALREADY_STARTED');
  }

  schedule.status = 'CANCELLED';
  schedule.cancel_reason = reason;
  await schedule.save();

  await audit({
    action: 'CANCELLED_SHIFT',
    actorStaffId: actorStaff._id,
    entity: 'ShiftSchedule',
    entityId: String(schedule._id),
    details: { reason },
    ip,
  });

  const staff = await Staff.findById(schedule.staff_id).lean();
  return toShiftDto(schedule, actual, staff);
}

// ─── 7. POST /shifts/:id/force-close ────────────────────────────────────────

async function forceCloseShift(shiftId, { reason }, actorStaff, ip) {
  if (!reason || reason.trim().length < 3 || reason.trim().length > 300) {
    throw E.validation('reason is required and must be between 3 and 300 characters', { field: 'reason' });
  }

  if (!mongoose.isValidObjectId(shiftId)) throw E.notFound('Shift not found');
  const schedule = await ShiftSchedule.findById(shiftId);
  if (!schedule) throw E.notFound('Shift not found');

  const actual = await Shift.findOne({
    staff_id: schedule.staff_id,
    shift_date: schedule.shift_date,
    shift_type: schedule.shift_type,
  });

  if (!actual) {
    throw E.conflict('No real shift to close', 'CONFLICT');
  }
  if (!isOpenShift(actual)) {
    throw E.unprocessable('Shift is already closed', 'INVALID_STATUS_TRANSITION');
  }

  const now = new Date();

  await runInTransaction(async (session) => {
    actual.status = 'handed_over';
    actual.handed_over_at = now;
    actual.shift_notes = `FORCE CLOSED by manager: ${reason.trim()}`;
    await actual.save({ session });

    // Revoke receptionist sessions
    await Session.updateMany(
      { staff_id: schedule.staff_id, revoked_at: null },
      { $set: { revoked_at: now } },
      { session }
    );
  });

  await audit({
    action: 'FORCED_CLOSE_SHIFT',
    actorStaffId: actorStaff._id,
    entity: 'Shift',
    entityId: String(actual._id),
    details: { reason: reason.trim(), shift_schedule_id: String(schedule._id) },
    ip,
  });

  const staff = await Staff.findById(schedule.staff_id).lean();
  return toShiftDto(schedule, actual, staff);
}

module.exports = {
  listShifts,
  getShiftOverview,
  getShiftRoster,
  createShift,
  updateShift,
  deleteShift,
  forceCloseShift,
};
