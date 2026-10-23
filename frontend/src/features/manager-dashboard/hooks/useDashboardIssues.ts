import { useQuery } from '@tanstack/react-query';
import {
  getDashboardIssues,
  managerDashboardQueryKeys,
} from '../services/manager-dashboard.api';
import { mapDashboardIssuesDto } from '../services/manager-dashboard.mappers';

export function useDashboardIssues(limit = 4) {
  return useQuery({
    queryKey: managerDashboardQueryKeys.issues(limit),
    queryFn: () => getDashboardIssues(limit),
    select: mapDashboardIssuesDto,
  });
}
