const mongoose = require('mongoose');
const MaintenanceIssue = require('../../db/models/MaintenanceIssue');
const Room = require('../../db/models/Room');
const { E } = require('../../utils/errors');
const { paginate } = require('../../utils/paginate');
const { sanitizeText } = require('../../utils/arabic');
const { audit } = require('../audit/audit.service');
const { toMaintenanceIssueDto } = require('./maintenance.dto');

async function createMaintenanceIssue({ room_id, problem, priority, notes, staff, shift, now, ip }) {
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

  const cleanProblem = sanitizeText(problem);
  const cleanNotes = notes !== undefined && notes !== null ? sanitizeText(notes) : '';
  const shiftId = shift ? shift._id : null;

  const issue = await MaintenanceIssue.create({
    room_id: room._id,
    shift_id: shiftId,
    staff_id: staff._id,
    problem: cleanProblem,
    priority: priority || 'medium',
    status: 'open',
    notes: cleanNotes,
    created_at: now || new Date(),
    resolved_at: null,
  });

  await audit({
    action: 'MAINTENANCE_CREATED',
    actorStaffId: staff._id,
    entity: 'MaintenanceIssue',
    entityId: issue._id,
    details: {
      room_id: String(issue.room_id),
      problem: issue.problem,
      priority: issue.priority,
      shift_id: shiftId ? String(shiftId) : null,
    },
    ip,
  });

  if (issue.priority === 'urgent') {
    try {
      const { notifyManagers } = require('../notifications/notify');
      await notifyManagers({
        type: 'CRITICAL_MAINTENANCE',
        title: 'Critical maintenance',
        message: 'Room ' + room.room_number,
        refType: 'MaintenanceRequest',
        refId: issue._id,
      });
    } catch (err) {
      // Failure here must never fail the receptionist's request
    }
  }

  issue.room_id = { _id: room._id, room_number: room.room_number };
  return toMaintenanceIssueDto(issue);
}

async function listMaintenanceIssues({ status, priority, room_id, page = 1, limit = 20 }) {
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (room_id) {
    if (mongoose.isValidObjectId(room_id)) {
      filter.room_id = room_id;
    } else {
      const room = await Room.findOne({ room_number: String(room_id) });
      filter.room_id = room ? room._id : null;
    }
  }

  return paginate(
    MaintenanceIssue,
    filter,
    { page, limit, sort: { createdAt: -1, _id: -1 }, populate: { path: 'room_id', select: 'room_number' } },
    toMaintenanceIssueDto
  );
}

async function getMaintenanceIssue(issueId) {
  if (!mongoose.isValidObjectId(issueId)) {
    throw E.notFound('Maintenance issue not found');
  }

  const issue = await MaintenanceIssue.findById(issueId).populate('room_id', 'room_number');
  if (!issue) {
    throw E.notFound('Maintenance issue not found');
  }

  return toMaintenanceIssueDto(issue);
}

async function updateMaintenanceIssue({ issueId, priority, notes, status, staff, shift, now, ip }) {
  if (!mongoose.isValidObjectId(issueId)) {
    throw E.notFound('Maintenance issue not found');
  }

  if (priority === undefined && notes === undefined && status === undefined) {
    throw E.validation('At least one field must be provided');
  }

  const issue = await MaintenanceIssue.findById(issueId);
  if (!issue) {
    throw E.notFound('Maintenance issue not found');
  }

  if (issue.status === 'resolved') {
    throw E.conflict('Maintenance issue is already resolved and cannot be modified');
  }

  const updates = {};
  const details = {};
  let condition = { _id: issue._id };

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
    if (status === 'in_progress') {
      if (issue.status !== 'open') {
        throw E.conflict('Issue can only transition to in_progress from open');
      }
      condition.status = 'open';
      updates.status = 'in_progress';
      details.status = 'in_progress';
    } else if (status === 'resolved') {
      if (!['open', 'in_progress'].includes(issue.status)) {
        throw E.conflict('Issue can only transition to resolved from open or in_progress');
      }
      condition.status = issue.status;
      updates.status = 'resolved';
      updates.resolved_at = now || new Date();
      details.status = 'resolved';
      details.resolved_at = (now || new Date()).toISOString();
    } else {
      throw E.validation(`Invalid status: ${status}`);
    }
  } else {
    condition.status = issue.status;
  }

  const res = await MaintenanceIssue.updateOne(condition, { $set: updates });
  if (res.modifiedCount !== 1) {
    throw E.conflict('Issue could not be updated or was modified concurrently');
  }

  await audit({
    action: 'MAINTENANCE_UPDATED',
    actorStaffId: staff._id,
    entity: 'MaintenanceIssue',
    entityId: issue._id,
    details: {
      ...details,
      shift_id: shift ? String(shift._id) : null,
    },
    ip,
  });

  const updatedIssue = await MaintenanceIssue.findById(issue._id).populate('room_id', 'room_number');
  return toMaintenanceIssueDto(updatedIssue);
}

module.exports = {
  createMaintenanceIssue,
  listMaintenanceIssues,
  getMaintenanceIssue,
  updateMaintenanceIssue,
};
