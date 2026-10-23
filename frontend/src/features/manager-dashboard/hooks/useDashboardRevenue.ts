import { useQuery } from '@tanstack/react-query';
import {
  getDashboardRevenue,
  managerDashboardQueryKeys,
} from '../services/manager-dashboard.api';
import { mapDashboardRevenueDto } from '../services/manager-dashboard.mappers';

export function useDashboardRevenue(days = 7) {
  return useQuery({
    queryKey: managerDashboardQueryKeys.revenue(days),
    queryFn: () => getDashboardRevenue(days),
    select: mapDashboardRevenueDto,
  });
}
