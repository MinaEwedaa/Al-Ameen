// Manager Leave Requests Service (M7)
// Implements complete leave requests workflow, validation, segregation of duties, and atomic shift cancellation

const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const {
  LeaveRequest,
  Staff,
  ShiftSchedule,
  Shift,
} = require('../../../db/models');
const { ZONE, todayCairo, eachDate } = require('../../../utils/time');
const { sanitizeText } = require('../../../utils/arabic');
const { E } = require('../../../utils/errors');
const { audit } = require('../../audit/audit.service');
const { notifyManagers, notifyStaff } = require('../../notifications/notify');
const { runInTransaction } = require('../../../utils/transaction');
const { ensureBaseline } = require('../common/schedule.service');
const { toLeaveDto } = require('./leave.dto');

const LEAVE_TYPES = ['ANNUAL', 'SICK', 'UNPAID', 'EMERGENCY'];

// ─── 1. POST /leave-requests (Receptionist) ─────────────────────────────────

async function createLeaveRequest({ leave_type, start_date, end_date, reason }, actorStaff, ip) {
  if (!leave_type || !LEAVE_TYPES.includes(leave_type.toUpperCase())) {
    throw E.validation('Valid leave_type is required (ANNUAL, SICK, UNPAID, EMERGENCY)', { field: 'leave_type' });
  }
  if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    throw E.validation('Valid start_date (YYYY-MM-DD) is required', { field: 'start_date' });
  }
  if (!end_date || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    throw E.validation('Valid end_date (YYYY-MM-DD) is required', { field: 'end_date' });
  }
  if (!reason || reason.trim().length < 3 || reason.trim().length > 500) {
    throw E.validation('reason is required and must be 3-500 characters', { field: 'reason' });
  }

  const today = todayCairo();
  if (start_date < today) {
    throw E.badRequest('start_date must not be before today');
  }
  if (end_date < start_date) {
    throw E.badRequest('end_date must not be before start_date');
  }

  const sDt = DateTime.fromISO(start_date, { zone: ZONE });
  const eDt = DateTime.fromISO(end_date, { zone: ZONE });
  if (eDt.diff(sDt, 'days').days > 60) {
    throw E.badRequest('Leave period cannot exceed 60 days');
  }

  // Check overlap with same person's PENDING or APPROVED leave
  const overlap = await LeaveRequest.findOne({
    staff_id: actorStaff._id,
    status: { $in: ['PENDING', 'APPROVED'] },
    start_date: { $lte: end_date },
    end_date: { $gte: start_date },
  }).lean();

  if (overlap) {
    throw E.conflict('Overlapping pending or approved leave request already exists', 'CONFLICT');
  }

  // Max 5 PENDING requests
  const pendingCount = await LeaveRequest.countDocuments({
    staff_id: actorStaff._id,
    status: 'PENDING',
  });
  if (pendingCount >= 5) {
    throw E.conflict('Maximum 5 pending leave requests reached', 'CONFLICT');
  }

  const cleanReason = sanitizeText(reason);
  let createdDoc;

  await runInTransaction(async (session) => {
    const [doc] = await LeaveRequest.create(
      [
        {
          staff_id: actorStaff._id,
          leave_type: leave_type.toUpperCase(),
          start_date,
          end_date,
          reason: cleanReason,
          status: 'PENDING',
        },
      ],
      { session }
    );
    createdDoc = doc;

    await notifyManagers(
      {
        type: 'LEAVE_REQUEST',
        title: 'Leave request',
        message: `${actorStaff.name} ${start_date} to ${end_date}`,
        refType: 'LeaveRequest',
        refId: createdDoc._id,
      },
      { session }
    );
  });

  await audit({
    action: 'CREATED_LEAVE_REQUEST',
    actorStaffId: actorStaff._id,
    entity: 'LeaveRequest',
    entityId: String(createdDoc._id),
    details: { leave_type: leave_type.toUpperCase(), start_date, end_date },
    ip,
  });

  return toLeaveDto(createdDoc.toObject(), actorStaff, 0);
}

// ─── 2. GET /leave-requests (Manager) ───────────────────────────────────────

async function listLeaveRequests({ status = 'PENDING', staff_id, from, to, page = 1, limit = 20 }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  const filter = {};
  if (status && status !== 'ALL') {
    filter.status = status.toUpperCase();
  }
  if (staff_id) {
    if (!mongoose.isValidObjectId(staff_id)) throw E.validation('Invalid staff_id');
    filter.staff_id = staff_id;
  }
  if (from && to) {
    filter.start_date = { $lte: to };
    filter.end_date = { $gte: from };
  } else if (from) {
    filter.end_date = { $gte: from };
  } else if (to) {
    filter.start_date = { $lte: to };
  }

  const total = await LeaveRequest.countDocuments(filter);
  const rows = await LeaveRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  if (rows.length === 0) {
    return { data: [], meta: { page: p, limit: l, total: 0, total_pages: 1 } };
  }

  // Batch query for staff names
  const staffIds = [...new Set(rows.map((r) => String(r.staff_id)))];
  const staffList = await Staff.find({ _id: { $in: staffIds } }).select('name role department').lean();
  const staffMap = new Map(staffList.map((s) => [String(s._id), s]));

  // Batch calculation of scheduled shifts in period
  const minDate = rows.reduce((min, r) => (r.start_date < min ? r.start_date : min), rows[0].start_date);
  const maxDate = rows.reduce((max, r) => (r.end_date > max ? r.end_date : max), rows[0].end_date);

  await ensureBaseline(minDate, maxDate, staffIds);

  const scheduledRows = await ShiftSchedule.find({
    staff_id: { $in: staffIds },
    status: 'SCHEDULED',
    shift_date: { $gte: minDate, $lte: maxDate },
  })
    .select('staff_id shift_date')
    .lean();

  const data = rows.map((r) => {
    const sid = String(r.staff_id);
    const count = scheduledRows.filter(
      (s) => String(s.staff_id) === sid && s.shift_date >= r.start_date && s.shift_date <= r.end_date
    ).length;
    return toLeaveDto(r, staffMap.get(sid), count);
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

// ─── 3. GET /leave-requests/:id (Manager) ───────────────────────────────────

async function getLeaveRequestById(id) {
  if (!mongoose.isValidObjectId(id)) throw E.notFound('Leave request not found');
  const leave = await LeaveRequest.findById(id).lean();
  if (!leave) throw E.notFound('Leave request not found');

  const staff = await Staff.findById(leave.staff_id).select('name role department').lean();

  await ensureBaseline(leave.start_date, leave.end_date, [leave.staff_id]);

  const conflicts = await ShiftSchedule.find({
    staff_id: leave.staff_id,
    status: 'SCHEDULED',
    shift_date: { $gte: leave.start_date, $lte: leave.end_date },
  })
    .sort({ start_at: 1 })
    .lean();

  const conflictItems = conflicts.map((c) => ({
    shift_id: String(c._id),
    business_date: c.shift_date,
    shift_type: c.shift_type.toUpperCase(),
    start_at: c.start_at ? c.start_at.toISOString() : null,
    end_at: c.end_at ? c.end_at.toISOString() : null,
  }));

  // Count overlapping approved leaves in same department
  let overlappingCount = 0;
  if (staff && staff.department) {
    const deptStaff = await Staff.find({
      department: staff.department,
      _id: { $ne: leave.staff_id },
    })
      .select('_id')
      .lean();

    const deptStaffIds = deptStaff.map((s) => s._id);
    if (deptStaffIds.length > 0) {
      overlappingCount = await LeaveRequest.countDocuments({
        staff_id: { $in: deptStaffIds },
        status: 'APPROVED',
        start_date: { $lte: leave.end_date },
        end_date: { $gte: leave.start_date },
      });
    }
  }

  const dto = toLeaveDto(leave, staff, conflictItems.length);
  return {
    ...dto,
    conflicts: conflictItems,
    overlapping_approved_leaves: overlappingCount,
  };
}

// ─── 4. PATCH /leave-requests/:id/decision (Manager) ────────────────────────

async function decideLeaveRequest(id, { action, manager_comment, cancel_scheduled_shifts = false }, actorStaff, ip) {
  if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
    throw E.validation('action must be APPROVE or REJECT', { field: 'action' });
  }
  const cleanAction = action.toUpperCase();

  if (cleanAction === 'REJECT' && (!manager_comment || !manager_comment.trim())) {
    throw E.badRequest('manager_comment is required when rejecting a leave request');
  }

  if (manager_comment && manager_comment.length > 500) {
    throw E.validation('manager_comment must not exceed 500 characters', { field: 'manager_comment' });
  }

  if (!mongoose.isValidObjectId(id)) throw E.notFound('Leave request not found');

  const curBefore = await LeaveRequest.findById(id).lean();
  if (!curBefore) throw E.notFound('Leave request not found');

  // Baseline materialization for staff member's period BEFORE the transaction
  await ensureBaseline(curBefore.start_date, curBefore.end_date, [curBefore.staff_id]);

  const now = new Date();
  let cancelledCount = 0;
  let updatedDoc;

  await runInTransaction(async (session) => {
    // Atomically claim request with database-level segregation of duties ($ne: actorStaff._id)
    const upd = await LeaveRequest.findOneAndUpdate(
      {
        _id: id,
        status: 'PENDING',
        staff_id: { $ne: actorStaff._id },
      },
      {
        $set: {
          status: cleanAction === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          decided_by_staff_id: actorStaff._id,
          decided_at: now,
          manager_comment: manager_comment ? sanitizeText(manager_comment) : null,
        },
      },
      { new: true, session }
    );

    if (!upd) {
      const cur = await LeaveRequest.findById(id).session(session).lean();
      if (!cur) throw E.notFound('Leave request not found');
      if (String(cur.staff_id) === String(actorStaff._id)) {
        throw E.forbidden('Cannot approve own request', 'CANNOT_APPROVE_OWN_REQUEST');
      }
      throw E.conflict('Already decided', 'RECORD_ALREADY_DECIDED');
    }

    updatedDoc = upd;

    if (cleanAction === 'APPROVE' && cancel_scheduled_shifts) {
      // Never touch a shift that already has a real Shift record
      const real = await Shift.find({
        staff_id: upd.staff_id,
        shift_date: { $gte: upd.start_date, $lte: upd.end_date },
      })
        .select('shift_date shift_type')
        .session(session)
        .lean();

      const filter = {
        staff_id: upd.staff_id,
        shift_date: { $gte: upd.start_date, $lte: upd.end_date },
        status: 'SCHEDULED',
        end_at: { $gt: now },
      };

      if (real.length > 0) {
        filter.$nor = real.map((r) => ({
          shift_date: r.shift_date,
          shift_type: r.shift_type,
        }));
      }

      const cancelResult = await ShiftSchedule.updateMany(
        filter,
        { $set: { status: 'CANCELLED', cancel_reason: 'LEAVE_APPROVED' } },
        { session }
      );

      cancelledCount = cancelResult.modifiedCount;
      await LeaveRequest.updateOne(
        { _id: id },
        { $set: { shifts_cancelled_count: cancelledCount } },
        { session }
      );
    }

    // Decision notification to employee is always sent in same transaction
    await notifyStaff(
      upd.staff_id,
      {
        type: 'LEAVE_DECISION',
        title: `Leave ${cleanAction.toLowerCase()}`,
        message: manager_comment ? sanitizeText(manager_comment) : '',
        refType: 'LeaveRequest',
        refId: id,
      },
      { session }
    );
  });

  await audit({
    action: cleanAction === 'APPROVE' ? 'APPROVED_LEAVE' : 'REJECTED_LEAVE',
    actorStaffId: actorStaff._id,
    entity: 'LeaveRequest',
    entityId: id,
    details: {
      action: cleanAction,
      shifts_cancelled_count: cancelledCount,
    },
    ip,
  });

  return {
    id: String(updatedDoc._id),
    staff_id: String(updatedDoc.staff_id),
    status: updatedDoc.status,
    decided_by_staff_id: String(actorStaff._id),
    decided_at: now.toISOString(),
    shifts_cancelled_count: cancelledCount,
    manager_comment: updatedDoc.manager_comment,
  };
}

module.exports = {
  createLeaveRequest,
  listLeaveRequests,
  getLeaveRequestById,
  decideLeaveRequest,
};
