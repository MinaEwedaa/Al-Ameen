import { SHIFT_ORDER } from '../constants/shifts.constants';
import type { Assignee, ShiftType } from '../types/shift.types';

export interface AssignmentFormValues {
  staffId: string;
  shift: ShiftType | '';
}

/** Values are i18n keys under manager.shifts.errors */
export type AssignmentFormErrors = Partial<Record<keyof AssignmentFormValues, string>>;

export const EMPTY_ASSIGNMENT: AssignmentFormValues = { staffId: '', shift: '' };

export function validateAssignment(values: AssignmentFormValues, assignees: Assignee[]): AssignmentFormErrors {
  const errors: AssignmentFormErrors = {};
  const assignee = assignees.find((item) => item.staff_id === values.staffId);
  if (!values.staffId) errors.staffId = 'employeeRequired';
  else if (!assignee) errors.staffId = 'employeeNotFound';
  else if (assignee.today_shift && assignee.today_shift.status !== 'SCHEDULED') errors.staffId = 'shiftStarted';
  if (!values.shift || !SHIFT_ORDER.includes(values.shift)) errors.shift = 'shiftRequired';
  else if (assignee?.today_shift?.shift_type === values.shift) errors.shift = 'sameShift';
  return errors;
}

export interface ReviewFormValues {
  comment: string;
}

/** A NEEDS_REVIEW decision must explain what to fix; an approval comment is optional */
export function validateReview(values: ReviewFormValues, status: 'APPROVED' | 'NEEDS_REVIEW', max: number): string | null {
  const comment = values.comment.trim();
  if (status === 'NEEDS_REVIEW' && !comment) return 'commentRequired';
  if (comment.length > max) return 'commentTooLong';
  return null;
}
