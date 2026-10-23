// Manager Dashboard API Service
// Implements exact endpoints from Manager API Contract v1.2

import { request } from '../../../core/api/apiClient';
import { getCairoBusinessDate } from '../utils/cairoDate';
import type {
  DashboardOverviewDto,
  DashboardRevenueDto,
  DashboardIssueDto,
  HotelActivityDto,
  ShiftOverviewDto,
  StaffMemberDto,
} from '../types/manager-dashboard.dto';

export const managerDashboardQueryKeys = {
  all: ['manager-dashboard'] as const,
  overview: () => [...managerDashboardQueryKeys.all, 'overview'] as const,
  revenue: (days: number) => [...managerDashboardQueryKeys.all, 'revenue', days] as const,
  issues: (limit: number) => [...managerDashboardQueryKeys.all, 'issues', limit] as const,
  activities: (limit: number) => [...managerDashboardQueryKeys.all, 'activities', limit] as const,
  shifts: (businessDate: string) =>
    [...managerDashboardQueryKeys.all, 'shifts', businessDate] as const,
  staff: (onShift: boolean) =>
    [...managerDashboardQueryKeys.all, 'staff', { onShift }] as const,
  summary: () => [...managerDashboardQueryKeys.all, 'summary'] as const,
};

function unwrapResource<T>(res: unknown): T {
  if (res && typeof res === 'object' && 'data' in res) {
    const candidate = (res as { data: unknown }).data;
    if (candidate !== undefined) {
      return candidate as T;
    }
  }
  return res as T;
}

function unwrapList<T>(res: unknown): T[] {
  if (res && typeof res === 'object' && 'data' in res) {
    const candidate = (res as { data: unknown }).data;
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }
  return Array.isArray(res) ? (res as T[]) : [];
}

/**
 * 1. GET /dashboard/overview
 * Fetches dashboard overview metrics (8 KPIs, room counts, floor occupancies).
 */
export async function getDashboardOverview(): Promise<DashboardOverviewDto> {
  const res = await request<DashboardOverviewDto | { data: DashboardOverviewDto }>('/dashboard/overview');
  return unwrapResource<DashboardOverviewDto>(res);
}

/**
 * 2. GET /dashboard/revenue?days=7
 * Fetches weekly revenue trend, payment method shares, and change percentage.
 */
export async function getDashboardRevenue(days = 7): Promise<DashboardRevenueDto> {
  const res = await request<DashboardRevenueDto | { data: DashboardRevenueDto }>(`/dashboard/revenue?days=${days}`);
  return unwrapResource<DashboardRevenueDto>(res);
}

/**
 * 3. GET /dashboard/issues?limit=4
 * Fetches critical issues and tasks requiring attention.
 */
export async function getDashboardIssues(limit = 4): Promise<DashboardIssueDto[]> {
  const res = await request<DashboardIssueDto[] | { data: DashboardIssueDto[] }>(`/dashboard/issues?limit=${limit}`);
  return unwrapList<DashboardIssueDto>(res);
}

/**
 * 4. GET /activities?limit=4
 * Fetches latest hotel-wide operational activities.
 */
export async function getActivities(limit = 4): Promise<HotelActivityDto[]> {
  const res = await request<HotelActivityDto[] | { data: HotelActivityDto[] }>(`/activities?limit=${limit}`);
  return unwrapList<HotelActivityDto>(res);
}

/**
 * 5. GET /shifts/overview?business_date=YYYY-MM-DD
 * Fetches shifts for Cairo business date.
 */
export async function getShiftsOverview(businessDate?: string): Promise<ShiftOverviewDto[]> {
  const date = businessDate || getCairoBusinessDate();
  const res = await request<ShiftOverviewDto[] | { data: ShiftOverviewDto[] }>(
    `/shifts/overview?business_date=${encodeURIComponent(date)}`
  );
  return unwrapList<ShiftOverviewDto>(res);
}

/**
 * 6. GET /staff?include=today_shift,workload&on_shift=true
 * Fetches active staff members currently on duty with their workloads.
 */
export async function getStaff(onShift = true): Promise<StaffMemberDto[]> {
  const query = onShift
    ? 'include=today_shift,workload&on_shift=true'
    : 'include=today_shift,workload';
  const res = await request<StaffMemberDto[] | { data: StaffMemberDto[] }>(`/staff?${query}`);
  return unwrapList<StaffMemberDto>(res);
}
