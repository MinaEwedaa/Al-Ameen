const mongoose = require('mongoose');
const CleaningTask = require('../../db/models/CleaningTask');
const Room = require('../../db/models/Room');
const { E } = require('../../utils/errors');
const { paginate } = require('../../utils/paginate');
const { sanitizeText } = require('../../utils/arabic');
const { audit } = require('../audit/audit.service');
const { toCleaningTaskDto } = require('./cleaning.dto');

async function createCleaningTask({ room_id, priority, cleaner_name, notes, staff, shift, now, ip }) {
  let room = null;
  if (mongoose.isValidObjectId(room_id)) {
    room = await Room.findById(room_id);
  }
  if (!room) {
    room = await Room.findOne({ room_number: String(room_id) });
  }
  if (!room) {
    throw E.notFound('Room not found');
  }

  const cleanedNotes = notes !== undefined && notes !== null ? sanitizeText(notes) : '';
  const cleanedCleanerName = cleaner_name ? sanitizeText(cleaner_name) : null;

  const assignedByStaffId = cleanedCleanerName ? staff._id : null;
  const shiftId = shift ? shift._id : null;

  const task = await CleaningTask.create({
    room_id: room._id,
    shift_id: shiftId,
    assigned_by_staff_id: assignedByStaffId,
    priority: priority || 'medium',
    status: 'pending',
    notes: cleanedNotes,
    cleaner_name: cleanedCleanerName,
    assigned_at: now || new Date(),
    finished_at: null,
  });

  await audit({
    action: 'CLEANING_CREATED',
    actorStaffId: staff._id,
    entity: 'CleaningTask',
    entityId: task._id,
    details: {
      room_id: String(task.room_id),
      cleaner_name: task.cleaner_name,
      priority: task.priority,
      shift_id: shiftId ? String(shiftId) : null,
    },
    ip,
  });

  task.room_id = { _id: room._id, room_number: room.room_number };
  return toCleaningTaskDto(task);
}

async function listCleaningTasks({ status, priority, room_id, page = 1, limit = 20 }) {
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (room_id) {
    if (mongoose.isValidObjectId(room_id)) {
      filter.room_id = room_id;
    } else {
      const room = await Room.findOne({ room_number: String(room_id) });
      filter.room_id = room ? room._id : null; // will return 0 matches
    }
  }

  return paginate(
    CleaningTask,
    filter,
    { page, limit, sort: { assigned_at: -1, _id: -1 }, populate: { path: 'room_id', select: 'room_number' } },
    toCleaningTaskDto
  );
}

async function getCleaningTask(taskId) {
  if (!mongoose.isValidObjectId(taskId)) {
    throw E.notFound('Cleaning task not found');
  }

  const task = await CleaningTask.findById(taskId).populate('room_id', 'room_number');
  if (!task) {
    throw E.notFound('Cleaning task not found');
  }

  return toCleaningTaskDto(task);
}

async function updateCleaningTask({ taskId, cleaner_name, priority, notes, status, staff, shift, now, ip }) {
  if (!mongoose.isValidObjectId(taskId)) {
    throw E.notFound('Cleaning task not found');
  }

  if (
    cleaner_name === undefined &&
    priority === undefined &&
    notes === undefined &&
    status === undefined
  ) {
    throw E.validation('At least one field must be provided');
  }

  const task = await CleaningTask.findById(taskId);
  if (!task) {
    throw E.notFound('Cleaning task not found');
  }

  if (task.status === 'done') {
    throw E.conflict('Task is already done');
  }

  const updates = {};
  const details = {};

  if (cleaner_name !== undefined) {
    const cleanName = cleaner_name ? sanitizeText(cleaner_name) : null;
    updates.cleaner_name = cleanName;
    updates.assigned_by_staff_id = staff._id;
    details.cleaner_name = cleanName;
    details.assigned_by_staff_id = String(staff._id);
  }

  if (priority !== undefined) {
    updates.priority = priority;
    details.priority = priority;
  }

  if (notes !== undefined) {
    const cleanNotes = notes ? sanitizeText(notes) : '';
    updates.notes = cleanNotes;
    details.notes = cleanNotes;
  }

  if (status !== undefined) {
    if (status !== 'done') {
      throw E.validation('Invalid status transition');
    }
    updates.status = 'done';
    updates.finished_at = now || new Date();
    details.status = 'done';
    details.finished_at = (now || new Date()).toISOString();
  }

  const res = await CleaningTask.updateOne(
    { _id: task._id, status: 'pending' },
    { $set: updates }
  );

  if (res.modifiedCount !== 1) {
    throw E.conflict('Task is already done');
  }

  await audit({
    action: 'CLEANING_UPDATED',
    actorStaffId: staff._id,
    entity: 'CleaningTask',
    entityId: task._id,
    details: {
      ...details,
      shift_id: shift ? String(shift._id) : null,
    },
    ip,
  });

  const updatedTask = await CleaningTask.findById(task._id).populate('room_id', 'room_number');
  return toCleaningTaskDto(updatedTask);
}

module.exports = {
  createCleaningTask,
  listCleaningTasks,
  getCleaningTask,
  updateCleaningTask,
};
