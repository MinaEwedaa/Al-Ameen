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
  today_revenue: number; // TODO confirm with backend
  comparison_percentage: number; // e.g. 12.4 // TODO confirm with backend
  payment_methods: PaymentMethodShareDto[]; // Confirmed payment method enum
  chart_series: DailyRevenuePointDto[]; // TODO confirm with backend
  // The contract does not guarantee week/month/year totals.
  // TODO confirm with backend: week_total, month_total, year_total not guaranteed in v1.2
  week_total?: number;
  month_total?: number;
  year_total?: number;
}

// ===================== 3. GET /dashboard/issues?limit=4 =====================

export interface DashboardIssueDto {
  id: string; // TODO confirm with backend
  title: string; // TODO confirm with backend
  issue_type: 'maintenance' | 'housekeeping' | 'complaint' | 'system'; // TODO confirm with backend
  priority: 'critical' | 'high' | 'medium' | 'low'; // TODO confirm with backend
  reported_at: string; // TODO confirm with backend
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

export interface ShiftOverviewDto {
  id: string; // TODO confirm with backend
  shift_type: ShiftTypeEnum; // Confirmed contract enum: MORNING | EVENING | NIGHT
  status: ShiftStatusEnum; // Confirmed contract enum: SCHEDULED | ACTIVE | COMPLETED | CANCELLED
  start_time: string; // e.g. "07:00 ص" or "07:00" // TODO confirm with backend
  end_time: string; // e.g. "03:00 م" or "15:00" // TODO confirm with backend
  lead_employee_name: string; // TODO confirm with backend
  lead_employee_avatar?: string; // TODO confirm with backend
  rooms_serviced_count: number; // TODO confirm with backend
  revenue_collected: number; // TODO confirm with backend
}

// ===================== 6. GET /staff?include=today_shift,workload&on_shift=true =====================

export interface StaffShiftInfoDto {
  shift_name?: string; // e.g. 'صباحية' // TODO confirm with backend
  shift_type?: ShiftTypeEnum; // Confirmed enum // TODO confirm with backend
  start_time?: string; // TODO confirm with backend
  end_time?: string; // TODO confirm with backend
}

export interface StaffWorkloadDto {
  completed_tasks: number; // TODO confirm with backend
  pending_tasks: number; // TODO confirm with backend
}

export interface StaffMemberDto {
  id: string; // TODO confirm with backend
  name: string; // TODO confirm with backend
  role: StaffRoleEnum; // Confirmed contract enum: MANAGER | RECEPTIONIST | HOUSEKEEPER | TECHNICIAN | ADMIN
  avatar?: string; // TODO confirm with backend
  is_on_shift: boolean; // Confirmed on_shift filter
  status: 'on_shift' | 'available' | 'on_break'; // TODO confirm with backend
  today_shift?: StaffShiftInfoDto; // Included via ?include=today_shift // TODO confirm with backend
  workload?: StaffWorkloadDto; // Included via ?include=workload // TODO confirm with backend
}
