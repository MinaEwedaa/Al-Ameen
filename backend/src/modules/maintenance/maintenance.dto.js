const { DateTime } = require('luxon');
const { ZONE } = require('../../utils/time');

const cairoIso = (d) => (d ? DateTime.fromJSDate(new Date(d)).setZone(ZONE).toISO() : null);

function toMaintenanceIssueDto(issue) {
  const roomId = issue.room_id?._id ? String(issue.room_id._id) : (issue.room_id ? String(issue.room_id) : null);
  const roomNumber = issue.room_id?.room_number ?? (issue.room_number ?? null);

  return {
    issue_id: String(issue._id),
    room_id: roomId,
    room_number: roomNumber ? String(roomNumber) : null,
    problem: issue.problem,
    priority: issue.priority,
    status: issue.status,
    notes: issue.notes || null,
    created_date: cairoIso(issue.created_at) || cairoIso(issue.createdAt) || new Date().toISOString(),
    resolved_date: cairoIso(issue.resolved_at),
    shift_id: issue.shift_id ? String(issue.shift_id) : (issue.shift ? String(issue.shift) : null),
    staff_id: issue.staff_id ? String(issue.staff_id) : (issue.staff ? String(issue.staff) : null),
  };
}

module.exports = { toMaintenanceIssueDto };
