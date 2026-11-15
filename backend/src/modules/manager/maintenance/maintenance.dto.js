function toUpperPriority(p) {
  if (!p) return 'NORMAL';
  const norm = String(p).toUpperCase();
  if (norm === 'URGENT' || norm === 'RUSH') return 'RUSH';
  if (norm === 'HIGH') return 'HIGH';
  if (norm === 'MEDIUM' || norm === 'NORMAL') return 'NORMAL';
  if (norm === 'LOW') return 'LOW';
  return 'NORMAL';
}

function toLowerPriority(p) {
  if (!p) return 'medium';
  const norm = String(p).toUpperCase();
  if (norm === 'URGENT' || norm === 'RUSH') return 'urgent';
  if (norm === 'HIGH') return 'high';
  if (norm === 'LOW') return 'low';
  return 'medium';
}

function toUpperStatus(s) {
  if (!s) return 'OPEN';
  const norm = String(s).toUpperCase();
  if (norm === 'IN_PROGRESS' || norm === 'IN-PROGRESS') return 'IN_PROGRESS';
  if (norm === 'RESOLVED') return 'RESOLVED';
  return 'OPEN';
}

function toLowerStatus(s) {
  if (!s) return 'open';
  const norm = String(s).toUpperCase();
  if (norm === 'IN_PROGRESS' || norm === 'IN-PROGRESS') return 'in_progress';
  if (norm === 'RESOLVED') return 'resolved';
  return 'open';
}

function toManagerMaintenanceDto(issue) {
  const roomId = issue.room_id?._id ? String(issue.room_id._id) : (issue.room_id ? String(issue.room_id) : '');
  const roomNumber = issue.room_id?.room_number ? String(issue.room_id.room_number) : (issue.room_number ? String(issue.room_number) : '');
  const assignedStaff = issue.assigned_to_staff_id;
  const technicianId = assignedStaff?._id ? String(assignedStaff._id) : (assignedStaff ? String(assignedStaff) : null);
  const technicianName = assignedStaff?.name || assignedStaff?.full_name || issue.technician_name || null;

  return {
    issue_id: String(issue._id),
    room_id: roomId,
    room_number: roomNumber,
    problem: issue.problem || '',
    notes: issue.notes || null,
    priority: toUpperPriority(issue.priority),
    status: toUpperStatus(issue.status),
    assigned_to_staff_id: technicianId,
    technician_name: technicianName,
    created_at: issue.created_at ? new Date(issue.created_at).toISOString() : (issue.createdAt ? new Date(issue.createdAt).toISOString() : new Date().toISOString()),
    updated_at: issue.updated_at ? new Date(issue.updated_at).toISOString() : (issue.updatedAt ? new Date(issue.updatedAt).toISOString() : new Date().toISOString()),
    expected_resolution_at: issue.expected_resolution_at ? new Date(issue.expected_resolution_at).toISOString() : null,
    resolved_at: issue.resolved_at ? new Date(issue.resolved_at).toISOString() : null,
  };
}

module.exports = {
  toUpperPriority,
  toLowerPriority,
  toUpperStatus,
  toLowerStatus,
  toManagerMaintenanceDto,
};

