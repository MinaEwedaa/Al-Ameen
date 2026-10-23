// Manager Dashboard Types
// All contracts derived from Figma design slices 1_ManagerDashboard_01.jpg, _02.jpg, _03.jpg

export interface DashboardKpiItem {
  id: string;
  label: string;
  value: number;
  formattedValue?: string;
  subtitle: string;
  icon: string;
  tone?: 'teal' | 'gold' | 'amber' | 'rose' | 'neutral' | 'green';
  // TODO: confirm with backend - KPI calculation formulas and icon mappings
}

export interface DashboardKpis {
  totalRooms: DashboardKpiItem;
  occupiedRooms: DashboardKpiItem;
  availableRooms: DashboardKpiItem;
  cleaningRooms: DashboardKpiItem;
  maintenanceRooms: DashboardKpiItem;
  occupancyRate: DashboardKpiItem;
  todayRevenue: DashboardKpiItem;
  pendingTasks: DashboardKpiItem;
  // TODO: confirm with backend - whether KPIs are returned as map or array
}

export interface PaymentMethodBreakdown {
  id: string;
  name: string;
  percent: number;
  amount?: number;
  tone: 'primary' | 'gold' | 'teal' | 'neutral';
  // TODO: confirm with backend - supported payment gateway names and percentage calculation
}

export interface RevenueChartPoint {
  day: string;
  value: number;
  // TODO: confirm with backend - weekly date range grouping and timestamp format
}

export interface RevenueOverview {
  today: number;
  week: number;
  month: number;
  year: number;
  changePercent: number;
  paymentMethods: PaymentMethodBreakdown[];
  chartSeries: {
    points: number[];
    labels: string[];
    data?: RevenueChartPoint[];
  };
  // TODO: confirm with backend - revenue period aggregation logic
}

export interface FloorOccupancy {
  floorNumber: number;
  label: string;
  standardCount: number;
  vipCount: number;
  occupancyPercent: number;
  // TODO: confirm with backend - floor grouping and room count per floor
}

export interface RoomsOverview {
  total: number;
  occupancyPercent: number;
  vipCount: number;
  standardCount: number;
  statusCounts: {
    occupied: number;
    available: number;
    reserved: number;
    cleaning: number;
    maintenance: number;
  };
  perFloorOccupancy: FloorOccupancy[];
  // TODO: confirm with backend - whether reserved is grouped with occupied in occupancy %
}

export type CriticalIssueSeverity = 'critical' | 'high' | 'followup' | 'medium';

export interface CriticalIssueItem {
  id: string;
  title: string;
  roomNumber: string;
  issueType: string;
  severity: CriticalIssueSeverity;
  severityLabel: string;
  icon: string;
  createdAt?: string;
  // TODO: confirm with backend - critical issues source endpoints (housekeeping + maintenance + payments)
}

export type ShiftStatus = 'active' | 'upcoming' | 'completed';

export interface ShiftOverviewItem {
  id: string;
  name: string;
  timeRange: string;
  staffName: string;
  revenue: number;
  roomsCount: number;
  status: ShiftStatus;
  statusLabel: string;
  // TODO: confirm with backend - shift timing schema and multi-shift data structure
}

export interface RecentActivityItem {
  id: string;
  type: 'payment' | 'cleaning' | 'maintenance' | 'checkin';
  title: string;
  description: string;
  time: string;
  icon: string;
  tone: 'teal' | 'gold' | 'amber' | 'primary';
  // TODO: confirm with backend - activity log pagination and real-time event types
}

export type StaffMemberStatus = 'on_shift' | 'available' | 'on_break';

export interface StaffActivityItem {
  id: string;
  name: string;
  avatarLetter: string;
  role: string;
  shift: string;
  completedTasks: number | null;
  pendingTasks: number;
  status: StaffMemberStatus;
  statusLabel: string;
  // TODO: confirm with backend - staff live attendance sync and task completion tracking
}

export interface StaffActivityOverview {
  activeStaffCount: number;
  staffList: StaffActivityItem[];
  // TODO: confirm with backend - live staff roster endpoint
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  revenue: RevenueOverview;
  roomsOverview: RoomsOverview;
  criticalIssues: CriticalIssueItem[];
  shifts: ShiftOverviewItem[];
  activities: RecentActivityItem[];
  staffActivity: StaffActivityOverview;
  // TODO: confirm with backend - full manager dashboard aggregation endpoint response structure
}

// Alias for convenience
export type ManagerDashboardSummary = DashboardSummary;
