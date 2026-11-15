const mongoose = require('mongoose');
const MaintenanceIssue = require('../../../db/models/MaintenanceIssue');
const Room = require('../../../db/models/Room');
const Staff = require('../../../db/models/Staff');
const { E } = require('../../../utils/errors');
const { sanitizeText } = require('../../../utils/arabic');
const { audit } = require('../../audit/audit.service');
const {
  toLowerPriority,
  toLowerStatus,
  toManagerMaintenanceDto,
} = require('./maintenance.dto');

async function listMaintenanceIssues({ room_id, status, priority, technician, limit = 100, page = 1 }) {
  const query = {};

  if (status) {
    query.status = toLowerStatus(status);
  }

  if (priority) {
    query.priority = toLowerPriority(priority);
  }

  if (room_id) {
    if (mongoose.isValidObjectId(room_id)) {
      query.room_id = room_id;
    } else {
      const room = await Room.findOne({ room_number: String(room_id) });
      query.room_id = room ? room._id : null;
    }
  }

  if (technician) {
    if (technician === 'unassigned') {
      query.assigned_to_staff_id = null;
    } else if (mongoose.isValidObjectId(technician)) {
      query.assigned_to_staff_id = technician;
    }
  }

  const issues = await MaintenanceIssue.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(parseInt(limit, 10) || 100, 200))
    .skip(((parseInt(page, 10) || 1) - 1) * (parseInt(limit, 10) || 100))
    .populate('room_id', 'room_number')
    .populate('assigned_to_staff_id', 'name full_name username');

  return {
    data: issues.map(toManagerMaintenanceDto),
  };
}

async function createMaintenanceTicket({ room_id, problem, priority, assigned_to_staff_id, notes, staff, ip }) {
  if (!room_id) throw E.validation('room_id is required', { field: 'room_id' });
  if (!problem) throw E.validation('problem is required', { field: 'problem' });

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

  let techId = null;
  if (assigned_to_staff_id) {
    if (!mongoose.isValidObjectId(assigned_to_staff_id)) {
      throw E.validation('Invalid assigned_to_staff_id');
    }
    const tech = await Staff.findById(assigned_to_staff_id);
    if (!tech) throw E.notFound('Technician not found');
    techId = tech._id;
  }

  const cleanProblem = sanitizeText(problem);
  const cleanNotes = notes ? sanitizeText(notes) : '';
  const dbPriority = toLowerPriority(priority);

  const issue = await MaintenanceIssue.create({
    room_id: room._id,
    staff_id: staff?._id || null,
    assigned_to_staff_id: techId,
    problem: cleanProblem,
    priority: dbPriority,
    status: techId ? 'in_progress' : 'open',
    notes: cleanNotes,
    created_at: new Date(),
    resolved_at: null,
  });

  await audit({
    action: 'MAINTENANCE_CREATED',
    actorStaffId: staff?._id,
    entity: 'MaintenanceIssue',
    entityId: issue._id,
    details: {
      room_number: room.room_number,
      problem: cleanProblem,
      priority: dbPriority,
      assigned_to_staff_id: techId ? String(techId) : null,
    },
    ip,
  });

  const populated = await MaintenanceIssue.findById(issue._id)
    .populate('room_id', 'room_number')
    .populate('assigned_to_staff_id', 'name full_name username');

  return {
    data: toManagerMaintenanceDto(populated),
  };
}

async function updateMaintenanceTicket({ id, assigned_to_staff_id, status, expected_resolution_at, notes, priority, staff, ip }) {
  if (!mongoose.isValidObjectId(id)) {
    throw E.notFound('Maintenance ticket not found');
  }

  const issue = await MaintenanceIssue.findById(id);
  if (!issue) {
    throw E.notFound('Maintenance ticket not found');
  }

  const updates = {};
  const details = {};

  if (assigned_to_staff_id !== undefined) {
    if (assigned_to_staff_id === null || assigned_to_staff_id === '') {
      updates.assigned_to_staff_id = null;
      details.assigned_to_staff_id = null;
    } else {
      if (!mongoose.isValidObjectId(assigned_to_staff_id)) {
        throw E.validation('Invalid assigned_to_staff_id');
      }
      const tech = await Staff.findById(assigned_to_staff_id);
      if (!tech) throw E.notFound('Technician not found');
      updates.assigned_to_staff_id = tech._id;
      details.assigned_to_staff_id = String(tech._id);
    }
  }

  if (status !== undefined) {
    const dbStatus = toLowerStatus(status);
    updates.status = dbStatus;
    details.status = dbStatus;
    if (dbStatus === 'resolved') {
      updates.resolved_at = new Date();
      details.resolved_at = updates.resolved_at.toISOString();
    } else {
      updates.resolved_at = null;
    }
  }

  if (expected_resolution_at !== undefined) {
    updates.expected_resolution_at = expected_resolution_at ? new Date(expected_resolution_at) : null;
    details.expected_resolution_at = updates.expected_resolution_at ? updates.expected_resolution_at.toISOString() : null;
  }

  if (notes !== undefined) {
    updates.notes = notes ? sanitizeText(notes) : '';
    details.notes = updates.notes;
  }

  if (priority !== undefined) {
    const dbPriority = toLowerPriority(priority);
    updates.priority = dbPriority;
    details.priority = dbPriority;
  }

  await MaintenanceIssue.updateOne({ _id: issue._id }, { $set: updates });

  await audit({
    action: 'MAINTENANCE_UPDATED',
    actorStaffId: staff?._id,
    entity: 'MaintenanceIssue',
    entityId: issue._id,
    details,
    ip,
  });

  const populated = await MaintenanceIssue.findById(issue._id)
    .populate('room_id', 'room_number')
    .populate('assigned_to_staff_id', 'name full_name username');

  return {
    data: toManagerMaintenanceDto(populated),
  };
}

module.exports = {
  listMaintenanceIssues,
  createMaintenanceTicket,
  updateMaintenanceTicket,
};
