// Manager Reports API Service
// Implements Manager API Contract v1.2 endpoints and /mock-only/ reports endpoints

import { request } from '../../../core/api/apiClient';
import type {
  ListEnvelopeDto,
  SingleEnvelopeDto,
  DailyClosingHistoryDto,
  DailyClosingsQueryDto,
  DashboardRevenueResponseDto,
  DashboardOverviewResponseDto,
  ReportAggregatedDto,
  ReportsQueryFiltersDto,
} from '../types/manager-reports.dto';

export const reportQueryKeys = {
  all: ['manager-reports'] as const,
  aggregated: (params?: Record<string, unknown>) =>
    [...reportQueryKeys.all, 'aggregated', params] as const,
  dailyClosings: (params?: Record<string, unknown>) =>
    [...reportQueryKeys.all, 'daily-closings', params] as const,
  revenueDashboard: (days?: number) =>
    [...reportQueryKeys.all, 'dashboard-revenue', days] as const,
  overviewDashboard: () =>
    [...reportQueryKeys.all, 'dashboard-overview'] as const,
};

/**
 * GET /daily-closings
 * History of closings with an optional date range.
 * Contract v1.2 rule: always pass limit.
 */
export async function getDailyClosings(
  query: DailyClosingsQueryDto = {},
): Promise<ListEnvelopeDto<DailyClosingHistoryDto>> {
  const params: Record<string, unknown> = {
    limit: query.limit ?? 20,
    page: query.page ?? 1,
  };
  if (query.start_date) params.start_date = query.start_date;
  if (query.end_date) params.end_date = query.end_date;

  return request<ListEnvelopeDto<DailyClosingHistoryDto>>('/manager/daily-closings', {
    method: 'GET',
    params,
  });
}

/**
 * GET /dashboard/revenue?days=
 * Multi-day revenue trend, comparison percentage, payment-method breakdown.
 */
export async function getDashboardRevenue(
  days = 30,
): Promise<DashboardRevenueResponseDto> {
  const res = await request<SingleEnvelopeDto<DashboardRevenueResponseDto>>(
    '/manager/dashboard/revenue',
    {
      method: 'GET',
      params: { days },
    },
  );
  return res.data;
}

/**
 * GET /dashboard/overview
 * Overview of total rooms, occupancy by floor and by type, daily revenue.
 */
export async function getDashboardOverview(): Promise<DashboardOverviewResponseDto> {
  const res = await request<SingleEnvelopeDto<DashboardOverviewResponseDto>>(
    '/manager/dashboard/overview',
    {
      method: 'GET',
    },
  );
  return res.data;
}

/**
 * GET /mock-only/reports/aggregated
 * Aggregated period report (period totals, VIP vs standard performance, completed tasks, 12 monthly bars).
 * Not in contract v1.2; served from /mock-only/ mock handler. TODO confirm with backend.
 */
export async function getAggregatedReport(
  filters: ReportsQueryFiltersDto = {},
): Promise<ReportAggregatedDto> {
  const params: Record<string, unknown> = {
    period: filters.period ?? 'daily',
    date: filters.date ?? '2025-06-18',
    limit: filters.limit ?? 20,
  };
  if (filters.floor && filters.floor !== 'ALL') params.floor = filters.floor;
  if (filters.room_type && filters.room_type !== 'ALL') params.room_type = filters.room_type;
  if (filters.shift && filters.shift !== 'ALL') params.shift = filters.shift;
  if (filters.room_status && filters.room_status !== 'ALL') params.room_status = filters.room_status;
  if (filters.payment_method && filters.payment_method !== 'ALL') {
    params.payment_method = filters.payment_method;
  }
  if (filters.expense_category && filters.expense_category !== 'ALL') {
    params.expense_category = filters.expense_category;
  }
  if (filters.start_date) params.start_date = filters.start_date;
  if (filters.end_date) params.end_date = filters.end_date;

  const res = await request<SingleEnvelopeDto<ReportAggregatedDto>>(
    '/mock-only/reports/aggregated',
    {
      method: 'GET',
      params,
    },
  );
  return res.data;
}
