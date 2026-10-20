import { ROUTES } from '../../../core/constants/routes';
import { request } from '../../../core/api/apiClient';
import { mockShiftSummary } from '../../../mocks/dashboard';
import type { DashboardSummary } from '../types/dashboard.types';

export const mockDashboardSummary: DashboardSummary = {
  revenueTotal: 24850,
  // TODO: confirm with backend; the dashboard endpoint has no revenue-change field.
  revenueChangePercent: 12.4,
  cashRevenue: 16900,
  digitalRevenue: 7950,
  // TODO: confirm with backend; the dashboard endpoint has no weekly revenue series.
  revenue: [
    { dayKey: 'saturday', value: 9200 },
    { dayKey: 'sunday', value: 11300 },
    { dayKey: 'monday', value: 10800 },
    { dayKey: 'tuesday', value: 13300 },
    { dayKey: 'wednesday', value: 15100 },
    { dayKey: 'thursday', value: 13700 },
    { dayKey: 'friday', value: 17200 },
  ],
  stats: [
    { id: 'rooms-prepared', labelKey: 'dashboard.stats.roomsPrepared.label', captionKey: 'dashboard.stats.roomsPrepared.caption', value: 12, format: 'number', icon: 'bed', tone: 'green', marker: 'open' },
    { id: 'cleaning-requests', labelKey: 'dashboard.stats.cleaning.label', captionKey: 'dashboard.stats.cleaning.caption', value: 8, format: 'number', icon: 'sparkles', tone: 'green', marker: 'open' },
    { id: 'maintenance-reports', labelKey: 'dashboard.stats.maintenance.label', captionKey: 'dashboard.stats.maintenance.caption', value: 3, format: 'number', icon: 'wrench', tone: 'gold', marker: 'warning' },
    { id: 'revenue', labelKey: 'dashboard.stats.revenue.label', captionKey: 'dashboard.stats.revenue.caption', value: 24850, format: 'currency', icon: 'wallet', tone: 'gold', marker: 'open' },
    { id: 'pending-tasks', labelKey: 'dashboard.stats.pending.label', captionKey: 'dashboard.stats.pending.caption', value: 5, format: 'number', icon: 'clock', tone: 'gold', marker: 'warning' },
    { id: 'completed-tasks', labelKey: 'dashboard.stats.completed.label', captionKey: 'dashboard.stats.completed.caption', value: 14, format: 'number', icon: 'check', tone: 'green', marker: 'open' },
    { id: 'checkins', labelKey: 'dashboard.stats.checkins.label', captionKey: 'dashboard.stats.checkins.caption', value: 6, format: 'number', icon: 'transfer', tone: 'green', marker: 'open' },
    { id: 'checkouts', labelKey: 'dashboard.stats.checkouts.label', captionKey: 'dashboard.stats.checkouts.caption', value: 4, format: 'number', icon: 'login', tone: 'gold', marker: 'open' },
  ],
  // TODO: confirm with backend; the dashboard endpoint has no recent-activity feed.
  activity: [
    { id: 'activity-1', titleKey: 'dashboard.activity.items.checkin.title', descriptionKey: 'dashboard.activity.items.checkin.description', timeMinutesAgo: 12, icon: 'login', tone: 'green' },
    { id: 'activity-2', titleKey: 'dashboard.activity.items.checkout.title', descriptionKey: 'dashboard.activity.items.checkout.description', timeMinutesAgo: 18, icon: 'transfer', tone: 'green' },
    { id: 'activity-3', titleKey: 'dashboard.activity.items.maintenance.title', descriptionKey: 'dashboard.activity.items.maintenance.description', timeMinutesAgo: 31, icon: 'wrench', tone: 'gold' },
    { id: 'activity-4', titleKey: 'dashboard.activity.items.cleaning.title', descriptionKey: 'dashboard.activity.items.cleaning.description', timeMinutesAgo: 41, icon: 'bed', tone: 'green' },
  ],
  // TODO: confirm with backend; the dashboard endpoint has no needs-attention list.
  needsAttention: [
    { id: 'attention-1', titleKey: 'dashboard.attention.items.critical.title', detailKey: 'dashboard.attention.items.critical.detail', severity: 'critical', icon: 'wrench' },
    { id: 'attention-2', titleKey: 'dashboard.attention.items.high.title', detailKey: 'dashboard.attention.items.high.detail', severity: 'high', icon: 'sparkles' },
    { id: 'attention-3', titleKey: 'dashboard.attention.items.normal.title', detailKey: 'dashboard.attention.items.normal.detail', severity: 'normal', icon: 'bed' },
  ],
  // TODO: confirm with backend; quick actions are UI configuration, not API data.
  quickActions: [
    { id: 'quick-add-task', labelKey: 'dashboard.quickActions.addTask', icon: 'check', route: ROUTES.shiftHandover, primary: true },
    { id: 'quick-shift-note', labelKey: 'dashboard.quickActions.shiftNote', icon: 'sparkles', route: ROUTES.shiftHandover },
    { id: 'quick-payment', labelKey: 'dashboard.quickActions.payment', icon: 'wallet', route: ROUTES.payments },
    { id: 'quick-checkout', labelKey: 'dashboard.quickActions.checkout', icon: 'login', route: ROUTES.rooms },
    { id: 'quick-report', labelKey: 'dashboard.quickActions.report', icon: 'file', route: ROUTES.shiftReport },
    { id: 'quick-handover', labelKey: 'dashboard.quickActions.handover', icon: 'transfer', route: ROUTES.shiftHandover },
  ],
  // TODO: confirm with backend; no shift-progress fields are in GET /dashboard.
  shift: mockShiftSummary,
  pulse: { revenue: 24850, pendingTasks: 5, completedTasks: 14, arrivals: 18 },
};

interface DashboardApiResponse {
  total_rooms: number;
  rooms_by_status: {
    available: number;
    reserved: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
  };
  rooms_needing_cleaning: number;
  open_maintenance_issues: number;
  shift_payments_total: {
    cash: number;
    instapay: number;
    vodafone_cash: number;
    total: number;
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await request<DashboardApiResponse>('/dashboard');
  const stats = mockDashboardSummary.stats.map((stat) => {
    switch (stat.id) {
      case 'rooms-prepared':
        return { ...stat, value: response.rooms_by_status?.available ?? response.total_rooms };
      case 'cleaning-requests':
        return { ...stat, value: response.rooms_needing_cleaning };
      case 'maintenance-reports':
        return { ...stat, value: response.open_maintenance_issues };
      case 'revenue':
        return { ...stat, value: response.shift_payments_total.total };
      default:
        // TODO: confirm with backend; check-in/out and task totals are absent from this response.
        return stat;
    }
  });

  return {
    ...mockDashboardSummary,
    revenueTotal: response.shift_payments_total.total,
    cashRevenue: response.shift_payments_total.cash,
    digitalRevenue: response.shift_payments_total.instapay + response.shift_payments_total.vodafone_cash,
    stats,
    pulse: {
      ...mockDashboardSummary.pulse,
      revenue: response.shift_payments_total.total,
      // TODO: confirm with backend; pending/completed tasks and arrivals are absent from this response.
    },
  };
}
