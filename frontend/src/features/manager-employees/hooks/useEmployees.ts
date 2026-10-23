import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStaff,
  deactivateStaff,
  getShiftCoverage,
  getStaff,
  reactivateStaff,
  resetStaffPassword,
  scheduleShift,
  updateStaff,
} from '../services/employees.api';
import type { ShiftType, StaffCreate, StaffUpdate } from '../types/employee.types';
import { cairoBusinessDate } from '../utils/employeeDisplay';

export const employeesKeys = {
  all: ['manager-employees'] as const,
  list: () => [...employeesKeys.all, 'list'] as const,
  coverage: (day: string) => [...employeesKeys.all, 'coverage', day] as const,
};

// staleTime 0: the shifts page can move people between shifts, so the data is refetched on every visit
export function useStaff() {
  return useQuery({ queryKey: employeesKeys.list(), queryFn: getStaff, staleTime: 0 });
}

export function useShiftCoverage() {
  const day = cairoBusinessDate();
  return useQuery({ queryKey: employeesKeys.coverage(day), queryFn: () => getShiftCoverage(day), staleTime: 0 });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: employeesKeys.all });
}

/** POST /staff, then (optionally) POST /shifts for today. Resolves with the server-generated password. */
export function useCreateStaff() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ body, shift, idempotencyKey }: { body: StaffCreate; shift: ShiftType | null; idempotencyKey: string }) => {
      const created = await createStaff(body, idempotencyKey);
      let shiftError: unknown = null;
      if (shift) {
        try {
          await scheduleShift(created.staff_id, cairoBusinessDate(), shift);
        } catch (error) {
          // The account exists already; the shift can be set later from the shifts page
          shiftError = error;
        }
      }
      return { created, shiftError };
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateStaff() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ staffId, body }: { staffId: string; body: StaffUpdate }) => updateStaff(staffId, body),
    onSuccess: () => invalidate(),
  });
}

export function useSetStaffActive() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ staffId, active }: { staffId: string; active: boolean }) => (active ? reactivateStaff(staffId) : deactivateStaff(staffId)),
    onSuccess: () => invalidate(),
  });
}

export function useResetStaffPassword() {
  return useMutation({ mutationFn: (staffId: string) => resetStaffPassword(staffId) });
}
