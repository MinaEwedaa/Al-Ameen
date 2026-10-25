// Manager Housekeeping Service (M5)

const mongoose = require('mongoose');
const { CleaningTask, Room, Staff } = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { sanitizeText } = require('../../../utils/arabic');
const { audit } = require('../../audit/audit.service');
const { PRIORITY_MAP, PRIORITY_MAP_REV } = require('../common/names');

const PRIORITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

function toHousekeepingTaskDto(task, roomNumber = '') {
  const priorityApi = PRIORITY_MAP[task.priority] || 'NORMAL';
  const statusApi = task.status === 'done' ? 'COMPLETED' : 'PENDING';

  return {
    id: String(task._id),
    task_id: String(task._id),
    room_id: String(task.room_id?._id || task.room_id),
    room_number: roomNumber || task.room_id?.room_number || '',
    cleaner_name: task.cleaner_name || null,
    assigned_to_staff_id: task.assigned_to_staff_id ? String(task.assigned_to_staff_id) : null,
    priority: priorityApi,
    status: statusApi,
    notes: task.notes || '',
    created_at: task.createdAt ? task.createdAt.toISOString() : (task.assigned_at ? task.assigned_at.toISOString() : new Date().toISOString()),
  };
}

async function listHousekeepingTasks({ status, priority, room_id, page = 1, limit = 20 }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  const filter = {};
  if (status) {
    const s = status.toUpperCase();
    if (s === 'COMPLETED') filter.status = 'done';
    else if (s === 'PENDING') filter.status = { $ne: 'done' };
  }

  if (priority) {
    const dbPriority = PRIORITY_MAP_REV[priority.toUpperCase()];
    if (dbPriority) filter.priority = dbPriority;
  }

  if (room_id) {
    if (mongoose.isValidObjectId(room_id)) {
      filter.room_id = room_id;
    }
  }

  const [tasks, total] = await Promise.all([
    CleaningTask.find(filter)
      .populate('room_id', 'room_number')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    CleaningTask.countDocuments(filter),
  ]);

  const data = tasks.map((t) => toHousekeepingTaskDto(t, t.room_id?.room_number));

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

async function assignHousekeepingTask(taskId, { cleaner_name, assigned_to_staff_id, priority }, actorStaff, ip) {
  if (!mongoose.isValidObjectId(taskId)) throw E.notFound('Housekeeping task not found');
  const task = await CleaningTask.findById(taskId);
  if (!task) throw E.notFound('Housekeeping task not found');

  if (task.status === 'done') {
    throw E.unprocessable('Cannot reassign or edit a completed cleaning task', 'INVALID_STATUS_TRANSITION');
  }

  const updates = {};
  const before = {
    cleaner_name: task.cleaner_name,
    assigned_to_staff_id: task.assigned_to_staff_id,
    priority: task.priority,
  };

  if (assigned_to_staff_id !== undefined) {
    if (assigned_to_staff_id !== null) {
      if (!mongoose.isValidObjectId(assigned_to_staff_id)) {
        throw E.validation('Invalid assigned_to_staff_id', { field: 'assigned_to_staff_id' });
      }
      const staffMember = await Staff.findById(assigned_to_staff_id).lean();
      if (!staffMember || !staffMember.active) {
        throw E.validation('Staff member not found or inactive', { field: 'assigned_to_staff_id' });
      }
      if (staffMember.role !== 'housekeeper') {
        throw E.validation('Assigned staff must have housekeeper role', { field: 'assigned_to_staff_id' });
      }
      updates.assigned_to_staff_id = staffMember._id;
      if (!cleaner_name) {
        updates.cleaner_name = staffMember.name;
      }
    } else {
      updates.assigned_to_staff_id = null;
    }
  }

  if (cleaner_name !== undefined) {
    updates.cleaner_name = cleaner_name ? sanitizeText(cleaner_name) : null;
  }

  if (priority !== undefined) {
    const targetDbPriority = PRIORITY_MAP_REV[priority.toUpperCase()];
    if (!targetDbPriority) {
      throw E.validation(`Invalid priority: ${priority}`, { field: 'priority' });
    }

    const currentRank = PRIORITY_RANK[task.priority] || 2;
    const newRank = PRIORITY_RANK[targetDbPriority] || 2;

    if (newRank < currentRank) {
      throw E.unprocessable('Cannot lower task priority', 'INVALID_STATUS_TRANSITION');
    }
    updates.priority = targetDbPriority;
  }

  if (Object.keys(updates).length === 0) {
    throw E.validation('At least one field is required to update');
  }

  Object.assign(task, updates);
  await task.save();

  await audit({
    action: 'ASSIGNED_CLEANING_TASK',
    actorStaffId: actorStaff._id,
    entity: 'CleaningTask',
    entityId: taskId,
    details: { before, after: updates },
    ip,
  });

  const room = await Room.findById(task.room_id).select('room_number').lean();
  return { data: toHousekeepingTaskDto(task.toObject(), room?.room_number) };
}

module.exports = {
  listHousekeepingTasks,
  assignHousekeepingTask,
};
