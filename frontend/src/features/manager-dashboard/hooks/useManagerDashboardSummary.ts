import { useDashboardOverview } from './useDashboardOverview';
import { useDashboardRevenue } from './useDashboardRevenue';
import { useDashboardIssues } from './useDashboardIssues';
import { useDashboardActivities } from './useDashboardActivities';
import { useDashboardShifts } from './useDashboardShifts';
import { useDashboardStaff } from './useDashboardStaff';
import type { DashboardSummary } from '../types/manager-dashboard.types';

export function useManagerDashboardSummary() {
  const overviewQuery = useDashboardOverview();
  const revenueQuery = useDashboardRevenue(7);
  const issuesQuery = useDashboardIssues(4);
  const activitiesQuery = useDashboardActivities(4);
  const shiftsQuery = useDashboardShifts();
  const staffQuery = useDashboardStaff(true);

  const isLoading =
    overviewQuery.isLoading ||
    revenueQuery.isLoading ||
    issuesQuery.isLoading ||
    activitiesQuery.isLoading ||
    shiftsQuery.isLoading ||
    staffQuery.isLoading;

  const isError =
    overviewQuery.isError ||
    revenueQuery.isError ||
    issuesQuery.isError ||
    activitiesQuery.isError ||
    shiftsQuery.isError ||
    staffQuery.isError;

  const error =
    overviewQuery.error ||
    revenueQuery.error ||
    issuesQuery.error ||
    activitiesQuery.error ||
    shiftsQuery.error ||
    staffQuery.error;

  const refetch = async () => {
    await Promise.all([
      overviewQuery.refetch(),
      revenueQuery.refetch(),
      issuesQuery.refetch(),
      activitiesQuery.refetch(),
      shiftsQuery.refetch(),
      staffQuery.refetch(),
    ]);
  };

  let data: DashboardSummary | undefined = undefined;

  if (
    overviewQuery.data &&
    revenueQuery.data &&
    issuesQuery.data &&
    activitiesQuery.data &&
    shiftsQuery.data &&
    staffQuery.data
  ) {
    data = {
      kpis: overviewQuery.data.kpis,
      roomsOverview: overviewQuery.data.roomsOverview,
      revenue: revenueQuery.data,
      criticalIssues: issuesQuery.data,
      shifts: shiftsQuery.data,
      activities: activitiesQuery.data,
      staffActivity: staffQuery.data,
    };
  }

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
    queries: {
      overview: overviewQuery,
      revenue: revenueQuery,
      issues: issuesQuery,
      activities: activitiesQuery,
      shifts: shiftsQuery,
      staff: staffQuery,
    },
  };
}
