import { normalizeDigits } from '../../../utils/digits';
import {
  MT_NOTES_MAX_LENGTH,
  MT_PROBLEM_MAX_LENGTH,
  MT_PROBLEM_MIN_LENGTH,
  NEXT_STATUSES,
  PRIORITY_OPTIONS,
} from '../constants/maintenance.constants';
import type { MaintenanceIssueCreate, MaintenanceIssueStatus, MaintenanceIssueUpdate, Priority } from '../types/maintenance.types';

export interface NewRequestFormValues {
  /** What the user typed or picked, digits normalized to 0-9 */
  roomNumber: string;
  priority: Priority | '';
  problem: string;
  notes: string;
}

/** Values are i18n keys, the component translates them */
export type NewRequestFormErrors = Partial<Record<keyof NewRequestFormValues, string>>;

// A new issue always starts as "open" on the server, so the form has no status field
export const EMPTY_NEW_REQUEST: NewRequestFormValues = { roomNumber: '', priority: '', problem: '', notes: '' };

/**
 * `roomOptions` are the room numbers from GET /rooms. While they are still loading the list is empty,
 * so the "room not found" check is skipped and the server has the final word.
 */
export function validateNewRequest(values: NewRequestFormValues, roomOptions: string[]): NewRequestFormErrors {
  const errors: NewRequestFormErrors = {};
  const room = normalizeDigits(values.roomNumber.trim());
  const problem = values.problem.trim();
  if (!room) errors.roomNumber = 'mtErrRoomRequired';
  else if (roomOptions.length > 0 && !roomOptions.includes(room)) errors.roomNumber = 'mtErrRoomNotFound';
  if (!values.priority || !PRIORITY_OPTIONS.includes(values.priority)) errors.priority = 'mtErrPriorityRequired';
  if (!problem) errors.problem = 'mtErrDescriptionRequired';
  else if (problem.length < MT_PROBLEM_MIN_LENGTH) errors.problem = 'mtErrDescriptionTooShort';
  else if (problem.length > MT_PROBLEM_MAX_LENGTH) errors.problem = 'mtErrDescriptionTooLong';
  if (values.notes.trim().length > MT_NOTES_MAX_LENGTH) errors.notes = 'mtErrNotesTooLong';
  return errors;
}

export function hasErrors(errors: NewRequestFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

type NextStatus = NonNullable<MaintenanceIssueUpdate['status']>;

/** Status update in the details drawer: one of the allowed next statuses. Returns an i18n key or undefined. */
export function validateStatusChange(current: MaintenanceIssueStatus, next: NextStatus | ''): string | undefined {
  if (!next || !NEXT_STATUSES[current].includes(next)) return 'mtChooseStatus';
  return undefined;
}

/** Request body for POST /maintenance-issues. Call only after validateNewRequest returned no errors. */
export function toCreateRequestBody(values: NewRequestFormValues): MaintenanceIssueCreate {
  const notes = values.notes.trim();
  return {
    room_id: normalizeDigits(values.roomNumber.trim()),
    problem: values.problem.trim(),
    priority: values.priority as Priority,
    ...(notes ? { notes } : {}),
  };
}
