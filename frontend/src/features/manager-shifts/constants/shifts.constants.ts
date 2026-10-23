import type { BadgeTone } from '../../../components/ui/Badge';
import type { ReviewStatus, ShiftStatus, ShiftType, StaffType } from '../types/shift.types';

/** All texts of this feature live under this i18n block */
export const SHIFTS_I18N = 'manager.shifts';

export const SHIFT_ORDER: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];
export const REPORTS_FETCH_LIMIT = 20;
export const STAFF_FETCH_LIMIT = 100;
export const COMMENT_MAX_LENGTH = 500;

/** Staff the assignments drawer can move (managers and admins are not on duty rosters) */
export const ROSTER_STAFF_TYPES: StaffType[] = ['RECEPTIONIST', 'HOUSEKEEPER', 'TECHNICIAN'];

export const RUN_STATUS_TONE: Record<ShiftStatus, BadgeTone> = {
  ACTIVE: 'info',
  SCHEDULED: 'neutral',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export const REVIEW_STATUS_TONE: Record<ReviewStatus, BadgeTone> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  NEEDS_REVIEW: 'danger',
};

/** API error codes this feature explains with its own message (manager.shifts.apiErrors.*) */
export const KNOWN_API_ERRORS = ['SHIFT_OVERLAP', 'SHIFT_ALREADY_STARTED', 'RECORD_ALREADY_DECIDED', 'NO_OPEN_BUSINESS_DAY'] as const;

/** Query params of the drawers */
export const PARAM_ASSIGN = 'assign';
export const PARAM_REPORT = 'report';
export const PARAM_DETAILS = 'details';
export const PARAM_REVIEW = 'review';
export const DRAWER_PARAMS = [PARAM_ASSIGN, PARAM_REPORT, PARAM_DETAILS, PARAM_REVIEW];
