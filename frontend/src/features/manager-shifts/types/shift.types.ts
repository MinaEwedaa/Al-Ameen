// Shapes from Manager API Contract v1.2 (§6 Shifts, §8 Shift reports).

/** v1.2: MongoDB ObjectId sent as a string, e.g. "6719b4a1f2e8c90012ab34cd" */
export type EntityId = string;

export type ShiftType = 'MORNING' | 'EVENING' | 'NIGHT';
export type ShiftStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_REVIEW';
export type StaffType = 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPER' | 'TECHNICIAN' | 'ADMIN';

/** GET /shifts/overview?business_date= */
export interface ShiftOverview {
  shift_type: ShiftType;
  shift_id: EntityId | null;
  status: ShiftStatus;
  start_time: string;
  end_time: string;
  staff: { staff_id: EntityId; full_name: string } | null;
  team_count: number;
  rooms_handled: number;
  gross_revenue: number;
  cleaning_tasks: number;
  maintenance_requests: number;
  pending_items: number;
  report: { report_id: EntityId; review_status: ReviewStatus } | null;
}

/** GET /shifts?business_date=&shift_type= */
export interface ShiftEntry {
  shift_id: EntityId;
  business_date: string;
  staff_id: EntityId;
  staff_name: string;
  shift_type: ShiftType;
  status: ShiftStatus;
  start_time: string;
  end_time: string;
}

/**
 * GET /shift-reports list item. The contract only shows the review response;
 * the fields marked optional are what the design's table needs. TODO confirm with backend (request S2).
 */
export interface ShiftReport {
  report_id: EntityId;
  shift_id: EntityId;
  business_date: string;
  gross_revenue: number;
  refunds_total: number;
  net_revenue: number;
  review_status: ReviewStatus;
  reviewed_by_staff_id?: EntityId | null;
  manager_comment?: string | null;
  shift_type?: ShiftType;
  staff_name?: string;
  rooms_handled?: number;
  cleaning_tasks?: number;
  maintenance_requests?: number;
  pending_items?: number;
  pdf_url?: string | null;
}

/** GET /shift-reports/{id}: v1.2 §9 splits collections into the three drawer methods */
export interface ShiftReportDetail extends ShiftReport {
  submitted_at?: string;
  cash_total?: number;
  instapay_total?: number;
  vodafone_cash_total?: number;
  /** Kept by the hotel from approved cancellations (v1.2 §8 settlements) */
  cancellation_retained_total?: number;
  reviewed_at?: string | null;
}

/** GET /shift-reports/{id}/handover */
export interface ShiftHandover {
  notes: string;
  follow_ups?: string[];
  pending_luggage?: string[];
}

/** GET /shift-reports/{id}/activities */
export interface ShiftActivity {
  activity_id: EntityId;
  event_type: string;
  description: string;
  amount?: number;
  timestamp: string;
}

/** GET /staff?include=today_shift — only what the assignments drawer needs */
export interface Assignee {
  staff_id: EntityId;
  full_name: string;
  staff_type: StaffType;
  is_active: boolean;
  today_shift: { shift_id: EntityId; shift_type: ShiftType; status: ShiftStatus } | null;
}
