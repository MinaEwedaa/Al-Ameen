import { useQuery } from '@tanstack/react-query';
import {
  getDashboardOverview,
  managerDashboardQueryKeys,
} from '../services/manager-dashboard.api';
import { mapDashboardOverviewDto } from '../services/manager-dashboard.mappers';

export function useDashboardOverview() {
  return useQuery({
    queryKey: managerDashboardQueryKeys.overview(),
    queryFn: getDashboardOverview,
    select: mapDashboardOverviewDto,
  });
}
