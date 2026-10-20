// Same shape as the backend API (snake_case), as agreed with the data layer (Member 5).
import type { MaintenanceIssueStatus, Priority } from '../../../types/common.types';

export type { MaintenanceIssueStatus, Priority };

export interface MaintenanceRequest {
  issue_id: string | number;
  room_id: string | number;
  room_number?: string | null;
  problem: string;
  priority: Priority;
  status: MaintenanceIssueStatus;
  created_date: string;
  shift_id: string | number;
  staff_id: string | number;
  notes?: string | null;
  resolved_date?: string | null;
}

export interface MaintenanceIssueCreate {
  room_id: string | number;
  problem: string;
  priority: Priority;
  notes?: string;
}

export interface MaintenanceIssueUpdate {
  priority?: Priority;
  notes?: string;
  status?: 'in_progress' | 'resolved';
}

// Page-only types (not sent to the backend)
export type MaintenanceFilterName = 'room' | 'priority' | 'status';

export interface MaintenanceFilters {
  q: string;
  room: string;
  priority: Priority | '';
  status: MaintenanceIssueStatus | '';
  page: number;
}

/** The room fields this page needs from GET /rooms */
export interface RoomRef {
  room_id: string | number;
  room_number?: string;
}
