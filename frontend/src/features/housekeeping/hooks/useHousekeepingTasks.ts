import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createHousekeepingTask, getHousekeepingTasks, getRoomNumbers, updateHousekeepingTask } from '../services/housekeeping.api';

export const housekeepingKeys = {
  all: ['housekeeping'] as const,
  tasks: () => [...housekeepingKeys.all, 'tasks'] as const,
  rooms: () => [...housekeepingKeys.all, 'rooms'] as const,
};

// Rooms rarely change during a shift, so the list is cached for a few minutes
export function useRoomNumbers() {
  return useQuery({ queryKey: housekeepingKeys.rooms(), queryFn: getRoomNumbers, staleTime: 5 * 60_000 });
}

export function useHousekeepingTasks() {
  return useQuery({ queryKey: housekeepingKeys.tasks(), queryFn: getHousekeepingTasks });
}

export function useCreateHousekeepingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHousekeepingTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: housekeepingKeys.all }),
  });
}

// The only status change the receptionist can make: pending -> done
export function useCompleteHousekeepingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string | number) => updateHousekeepingTask(taskId, { status: 'done' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: housekeepingKeys.all }),
  });
}
