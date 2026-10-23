import { useQuery } from '@tanstack/react-query';
import {
  getActivities,
  managerDashboardQueryKeys,
} from '../services/manager-dashboard.api';
import { mapHotelActivitiesDto } from '../services/manager-dashboard.mappers';

export function useDashboardActivities(limit = 4) {
  return useQuery({
    queryKey: managerDashboardQueryKeys.activities(limit),
    queryFn: () => getActivities(limit),
    select: mapHotelActivitiesDto,
  });
}
