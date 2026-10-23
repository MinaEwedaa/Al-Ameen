import type { BadgeTone } from '../../../components/ui/Badge';
import type { EmployeeStatus, ShiftType, StaffType } from '../types/employee.types';

/** All texts of this feature live under this i18n block */
export const EMPLOYEES_I18N = 'manager.employees';

export const EMPLOYEES_PAGE_SIZE = 6;
/** Contract max page size; the directory is filtered and paged on the page itself */
export const STAFF_FETCH_LIMIT = 100;

/** "إدارة الجدول" opens the assignments drawer of the shifts page. TODO use the ROUTES constant once the shell adds it. */
export const MANAGER_SHIFTS_ASSIGN_PATH = '/manager/shifts?assign=1';

export const STAFF_TYPE_OPTIONS: StaffType[] = ['RECEPTIONIST', 'HOUSEKEEPER', 'TECHNICIAN', 'MANAGER', 'ADMIN'];
export const SHIFT_OPTIONS: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];
export const STATUS_OPTIONS: EmployeeStatus[] = ['ON_DUTY', 'AVAILABLE', 'ON_BREAK', 'OFF_SHIFT', 'INACTIVE'];

/** Value used in the form and filters for "no shift today" */
export const NO_SHIFT = 'NONE';

export const STATUS_TONE: Record<EmployeeStatus, BadgeTone> = {
  ON_DUTY: 'info',
  AVAILABLE: 'success',
  ON_BREAK: 'neutral',
  OFF_SHIFT: 'warning',
  INACTIVE: 'danger',
};

export const FULL_NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 120;

/** API error codes this feature explains with its own message (manager.employees.apiErrors.*) */
export const KNOWN_API_ERRORS = ['CONFLICT', 'SHIFT_OVERLAP', 'SHIFT_ALREADY_STARTED', 'FORBIDDEN', 'INVALID_STATUS_TRANSITION'] as const;
