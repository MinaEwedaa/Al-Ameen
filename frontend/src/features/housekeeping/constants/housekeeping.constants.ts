import type { BadgeTone } from '../../../components/ui/Badge';
import type { CleaningTaskStatus, Priority } from '../types/housekeeping.types';

export const HK_PAGE_SIZE = 5;
export const HK_NOTES_MAX_LENGTH = 500;
export const HK_CLEANER_MAX_LENGTH = 60;
// The list endpoint pages its results; one shift never has more than this, so the page loads them in one call.
// TODO: switch to server-side paging (page + meta.total) if a shift can exceed this.
export const HK_FETCH_LIMIT = 100;

export const STATUS_OPTIONS: CleaningTaskStatus[] = ['pending', 'done'];
export const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high', 'urgent'];

export const STATUS_TONE: Record<CleaningTaskStatus, BadgeTone> = {
  pending: 'warning',
  done: 'success',
};

export const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  low: 'success',
  medium: 'neutral',
  high: 'warning',
  urgent: 'danger',
};

export const STATUS_LABEL_KEY: Record<CleaningTaskStatus, string> = {
  pending: 'hkStatus_pending',
  done: 'hkStatus_done',
};

export const PRIORITY_LABEL_KEY: Record<Priority, string> = {
  low: 'priorityLow',
  medium: 'priorityMedium',
  high: 'priorityHigh',
  urgent: 'priorityUrgent',
};
