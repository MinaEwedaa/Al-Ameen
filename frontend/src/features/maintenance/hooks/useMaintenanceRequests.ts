import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMaintenanceRequest,
  getMaintenanceRequests,
  getRoomNumbers,
  updateMaintenanceRequest,
} from '../services/maintenance.api';
import type { MaintenanceIssueUpdate } from '../types/maintenance.types';

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  requests: () => [...maintenanceKeys.all, 'requests'] as const,
  rooms: () => [...maintenanceKeys.all, 'rooms'] as const,
};

// Rooms rarely change during a shift, so the list is cached for a few minutes
export function useRoomNumbers() {
  return useQuery({ queryKey: maintenanceKeys.rooms(), queryFn: getRoomNumbers, staleTime: 5 * 60_000 });
}

export function useMaintenanceRequests() {
  return useQuery({ queryKey: maintenanceKeys.requests(), queryFn: getMaintenanceRequests });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMaintenanceRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: maintenanceKeys.all }),
  });
}

export function useUpdateMaintenanceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, status }: { issueId: string | number; status: NonNullable<MaintenanceIssueUpdate['status']> }) =>
      updateMaintenanceRequest(issueId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: maintenanceKeys.all }),
  });
}
