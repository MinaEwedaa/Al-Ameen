import type { BadgeTone } from '../../../components/ui/Badge';
import type { MaintenanceIssueStatus, MaintenanceIssueUpdate, Priority } from '../types/maintenance.types';

export const MT_PAGE_SIZE = 4;
export const MT_PROBLEM_MIN_LENGTH = 3;
export const MT_PROBLEM_MAX_LENGTH = 120;
export const MT_NOTES_MAX_LENGTH = 500;
// The list endpoint pages its results; one shift never has more than this, so the page loads them in one call.
// TODO: switch to server-side paging (page + meta.total) if a shift can exceed this.
export const MT_FETCH_LIMIT = 100;

export const STATUS_OPTIONS: MaintenanceIssueStatus[] = ['open', 'in_progress', 'resolved'];
export const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high', 'urgent'];

// Status moves forward only; a resolved issue cannot be changed (the API answers CONFLICT)
export const NEXT_STATUSES: Record<MaintenanceIssueStatus, NonNullable<MaintenanceIssueUpdate['status']>[]> = {
  open: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: [],
};

export const STATUS_TONE: Record<MaintenanceIssueStatus, BadgeTone> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
};

export const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  low: 'success',
  medium: 'neutral',
  high: 'warning',
  urgent: 'danger',
};

export const STATUS_LABEL_KEY: Record<MaintenanceIssueStatus, string> = {
  open: 'mtStatus_pending',
  in_progress: 'mtStatus_in_progress',
  resolved: 'mtStatus_resolved',
};

export const PRIORITY_LABEL_KEY: Record<Priority, string> = {
  low: 'priorityLow',
  medium: 'priorityMedium',
  high: 'priorityHigh',
  urgent: 'priorityUrgent',
};
