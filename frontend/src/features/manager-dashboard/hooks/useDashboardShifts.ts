import { useQuery } from '@tanstack/react-query';
import {
  getShiftsOverview,
  managerDashboardQueryKeys,
} from '../services/manager-dashboard.api';
import { mapShiftsOverviewDto } from '../services/manager-dashboard.mappers';
import { getCairoBusinessDate } from '../utils/cairoDate';

export function useDashboardShifts(businessDate?: string) {
  const date = businessDate || getCairoBusinessDate();
  return useQuery({
    queryKey: managerDashboardQueryKeys.shifts(date),
    queryFn: () => getShiftsOverview(date),
    select: mapShiftsOverviewDto,
  });
}
