// Manager Shifts DTO (M6)
// Maps ShiftSchedule and actual Shift records to Manager API contract v1.2

const { isOpenShift } = require('../common/shift.mapper');

function deriveStatus(scheduleRow, actualShift) {
  if (scheduleRow.status === 'CANCELLED') return 'CANCELLED';
  if (!actualShift) return 'SCHEDULED';
  return isOpenShift(actualShift) ? 'ACTIVE' : 'COMPLETED';
}

function toShiftDto(scheduleRow, actualShift = null, staff = null) {
  const staffObj = staff || scheduleRow.staff_id;
  const status = deriveStatus(scheduleRow, actualShift);

  return {
    id: String(scheduleRow._id),
    shift_id: String(scheduleRow._id),
    actual_shift_id: actualShift ? String(actualShift._id) : null,
    staff_id: staffObj ? String(staffObj._id || staffObj.id) : String(scheduleRow.staff_id),
    staff_name: staffObj?.name || 'Staff',
    staff_type: (staffObj?.role || 'receptionist').toUpperCase(),
    department: staffObj?.department || null,
    business_date: scheduleRow.shift_date,
    shift_type: scheduleRow.shift_type ? scheduleRow.shift_type.toUpperCase() : 'MORNING',
    start_at: scheduleRow.start_at ? new Date(scheduleRow.start_at).toISOString() : null,
    end_at: scheduleRow.end_at ? new Date(scheduleRow.end_at).toISOString() : null,
    status,
    cancel_reason: scheduleRow.cancel_reason || null,
    created_at: scheduleRow.createdAt ? new Date(scheduleRow.createdAt).toISOString() : null,
  };
}

module.exports = {
  deriveStatus,
  toShiftDto,
};
