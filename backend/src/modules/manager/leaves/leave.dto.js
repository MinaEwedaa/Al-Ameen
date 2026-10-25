// Manager Leave Requests DTO (M7)
// Maps LeaveRequest to Manager API contract v1.2 shape

function toLeaveDto(leave, staff = null, scheduledCount = 0) {
  const staffObj = staff || leave.staff_id;

  const dto = {
    id: String(leave._id),
    staff_id: staffObj ? String(staffObj._id || staffObj.id) : String(leave.staff_id),
    staff_name: staffObj?.name || 'Staff',
    staff_type: (staffObj?.role || 'receptionist').toUpperCase(),
    leave_type: leave.leave_type,
    start_date: leave.start_date,
    end_date: leave.end_date,
    reason: leave.reason || '',
    status: leave.status,
    scheduled_shifts_in_period: scheduledCount,
    created_at: leave.createdAt ? new Date(leave.createdAt).toISOString() : null,
  };

  if (leave.decided_at) {
    dto.decided_by_staff_id = leave.decided_by_staff_id ? String(leave.decided_by_staff_id) : null;
    dto.decided_at = new Date(leave.decided_at).toISOString();
    dto.manager_comment = leave.manager_comment || null;
    dto.shifts_cancelled_count = leave.shifts_cancelled_count || 0;
  }

  return dto;
}

module.exports = {
  toLeaveDto,
};
