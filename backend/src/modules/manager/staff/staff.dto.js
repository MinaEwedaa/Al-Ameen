// Manager Staff DTO
// Maps Staff (MongoDB) → manager API contract v1.2 shape

const { maskId } = require('../../../utils/crypto');

const ROLE_MAP = {
  receptionist: 'RECEPTIONIST',
  housekeeper: 'HOUSEKEEPER',
  technician: 'TECHNICIAN',
  manager: 'MANAGER',
  admin: 'ADMIN',
};

/**
 * Converts a Staff document to the manager API DTO.
 * @param {object} staff  - lean Staff document
 * @param {object} extras - { lastLogin, todayShift, workload }
 */
function toStaffDto(staff, { lastLogin = null, todayShift = null, workload = null } = {}) {
  const dto = {
    id: String(staff._id),
    staff_id: String(staff._id),
    username: staff.username || null,
    full_name: staff.name,
    email: staff.email || null,
    phone: staff.phone || null,
    department: staff.department || null,
    default_shift_type: staff.default_shift_type || null,
    national_id: staff.id_number_last4 ? '******' + staff.id_number_last4 : null,
    staff_type: ROLE_MAP[staff.role] || (staff.role ? staff.role.toUpperCase() : 'RECEPTIONIST'),
    hire_date: staff.hire_date ? staff.hire_date.toISOString().slice(0, 10) : null,
    is_active: staff.active !== false,
    deactivated_at: staff.deactivated_at ? staff.deactivated_at.toISOString() : null,
    created_at: staff.createdAt ? staff.createdAt.toISOString() : null,
    last_login_at: lastLogin ? new Date(lastLogin).toISOString() : null,
  };

  if (todayShift !== undefined) {
    dto.today_shift = todayShift;
  }
  if (workload !== undefined) {
    dto.workload = workload;
  }

  return dto;
}

/**
 * Extended DTO returned only on staff creation — includes temporary_password.
 */
function toStaffCreatedDto(staff, temporaryPassword) {
  return {
    ...toStaffDto(staff),
    temporary_password: temporaryPassword,
  };
}

module.exports = { toStaffDto, toStaffCreatedDto };
