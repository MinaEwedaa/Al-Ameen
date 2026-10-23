// Manager Dashboard Raw API DTOs & Response Envelopes
// Based on Manager API Contract v1.2

// ===================== CONFIRMED CONTRACT ENUMS =====================

export type ShiftTypeEnum = 'MORNING' | 'EVENING' | 'NIGHT';
export type ShiftStatusEnum = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethodEnum = 'CASH' | 'INSTAPAY' | 'VODAFONE_CASH' | 'CARD';
export type StaffRoleEnum = 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPER' | 'TECHNICIAN' | 'ADMIN';

// ===================== 1. GET /dashboard/overview =====================

export interface DashboardOverviewKpiDto {
  total_rooms: number; // TODO confirm with backend
  occupied_rooms: number; // TODO confirm with backend
  available_rooms: number; // TODO confirm with backend
  cleaning_rooms: number; // TODO confirm with backend
  maintenance_rooms: number; // TODO confirm with backend
  occupancy_rate: number; // e.g. 64 for 64% // TODO confirm with backend
  today_revenue: number; // e.g. 24850 // TODO confirm with backend
  today_revenue_change_pct?: number; // e.g. 12.4 // TODO confirm with backend
  pending_tasks: number; // TODO confirm with backend
}

export interface FloorOccupancyDto {
  floor: number; // TODO confirm with backend
  total: number; // TODO confirm with backend
  occupied: number; // TODO confirm with backend
  standard_count?: number; // TODO confirm with backend
  vip_count?: number; // TODO confirm with backend
  occupancy_pct: number; // TODO confirm with backend
}

export interface DashboardOverviewDto {
  kpis: DashboardOverviewKpiDto; // TODO confirm with backend
  room_counts: {
    total: number;
    standard: number;
    vip: number;
    occupied: number;
    available: number;
    reserved: number;
    cleaning: number;
    maintenance: number;
  }; // TODO confirm with backend
  floors_occupancy: FloorOccupancyDto[]; // TODO confirm with backend
}

// ===================== 2. GET /dashboard/revenue?days=7 =====================

export interface PaymentMethodShareDto {
  method: PaymentMethodEnum; // Confirmed contract enum: CASH | INSTAPAY | VODAFONE_CASH | CARD
  amount: number; // TODO confirm with backend
  percentage: number; // TODO confirm with backend
}

export interface DailyRevenuePointDto {
  date: string; // YYYY-MM-DD // TODO confirm with backend
  day_label?: string; // e.g. 'السبت' or 'Sat' // TODO confirm with backend
  revenue: number; // TODO confirm with backend
}

export interface DashboardRevenueDto {
  // Contract field names (v1.1 §4 GET /dashboard/revenue example); read first by the mapper
  totals?: { today: number; week: number; month: number; year: number };
  change_pct_vs_previous_day?: number;
  series?: Array<{ business_date: string; net_revenue: number }>;
  by_method?: Array<{ method: PaymentMethodEnum; amount: number; share_pct: number }>;
  // Earlier field names, kept as a fallback for the mocks
  today_revenue?: number; // TODO confirm with backend
  comparison_percentage?: number; // e.g. 12.4 // TODO confirm with backend
  payment_methods?: PaymentMethodShareDto[]; // Confirmed payment method enum
  chart_series?: DailyRevenuePointDto[]; // TODO confirm with backend
  // The contract does not guarantee week/month/year totals.
  // TODO confirm with backend: week_total, month_total, year_total not guaranteed in v1.2
  week_total?: number;
  month_total?: number;
  year_total?: number;
}

// ===================== 3. GET /dashboard/issues?limit=4 =====================

export interface DashboardIssueDto {
  // Contract field names (v1.1 §4 GET /dashboard/issues example); read first by the mapper
  issue_id?: string;
  type?: 'MAINTENANCE' | 'HOUSEKEEPING' | 'COMPLAINT' | 'SYSTEM' | string;
  severity?: 'CRITICAL' | 'HIGH' | 'RUSH' | 'MEDIUM' | 'LOW' | string;
  created_at?: string;
  // Earlier field names, kept as a fallback for the mocks
  id?: string; // TODO confirm with backend
  title: string; // TODO confirm with backend
  issue_type?: 'maintenance' | 'housekeeping' | 'complaint' | 'system'; // TODO confirm with backend
  priority?: 'critical' | 'high' | 'medium' | 'low'; // TODO confirm with backend
  reported_at?: string; // TODO confirm with backend
  room_number?: string; // TODO confirm with backend
  description?: string; // TODO confirm with backend
}

// ===================== 4. GET /activities?limit=4 =====================

export interface HotelActivityDto {
  id: string; // TODO confirm with backend
  title: string; // TODO confirm with backend
  description: string; // TODO confirm with backend
  timestamp: string; // TODO confirm with backend
  category?: 'room' | 'guest' | 'shift' | 'payment'; // TODO confirm with backend
  actor_name?: string; // TODO confirm with backend
}

// ===================== 5. GET /shifts/overview?business_date=YYYY-MM-DD =====================

// Contract v1.2 §7: one aggregated card per shift type for the business date
export interface ShiftOverviewDto {
  shift_type: ShiftTypeEnum;
  shift_id: string | null;
  status: ShiftStatusEnum;
  start_time: string; // ISO 8601 with offset
  end_time: string; // ISO 8601 with offset
  staff: { staff_id: string; full_name: string } | null;
  team_count: number;
  rooms_handled: number;
  gross_revenue: number;
  cleaning_tasks: number;
  maintenance_requests: number;
  pending_items: number;
  report: { report_id: string; review_status: 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_REVIEW' } | null;
}

// ===================== 6. GET /staff?include=today_shift,workload&on_shift=true =====================

/** TODO confirm with backend: the contract example shows only "AVAILABLE"; null = not checked in */
export type StaffPresenceEnum = 'ON_DUTY' | 'AVAILABLE' | 'ON_BREAK';

export interface StaffShiftInfoDto {
  shift_id: string;
  shift_type: ShiftTypeEnum;
  status: ShiftStatusEnum;
  presence: StaffPresenceEnum | null;
}

export interface StaffWorkloadDto {
  assigned_today: number;
  completed_today: number;
  open: number;
}

// Contract v1.2 §6 (GET /staff with include=today_shift,workload)
export interface StaffMemberDto {
  staff_id: string;
  full_name: string;
  staff_type: StaffRoleEnum;
  is_active: boolean;
  today_shift?: StaffShiftInfoDto | null;
  workload?: StaffWorkloadDto | null;
}
