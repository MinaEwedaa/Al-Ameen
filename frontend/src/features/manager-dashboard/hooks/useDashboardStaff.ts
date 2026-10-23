import { useQuery } from '@tanstack/react-query';
import {
  getStaff,
  managerDashboardQueryKeys,
} from '../services/manager-dashboard.api';
import { mapStaffMembersDto } from '../services/manager-dashboard.mappers';

export function useDashboardStaff(onShift = true) {
  return useQuery({
    queryKey: managerDashboardQueryKeys.staff(onShift),
    queryFn: () => getStaff(onShift),
    select: mapStaffMembersDto,
  });
}
