import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignShift,
  cancelShift,
  getAssignees,
  getShiftActivities,
  getShiftHandover,
  getShiftReport,
  getShiftReports,
  getShiftsOverview,
  getShiftTeam,
  reviewShiftReport,
} from '../services/shifts.api';
import type { Assignee, ReviewStatus, ShiftType } from '../types/shift.types';
import { cairoBusinessDate } from '../utils/shiftDisplay';

export const shiftsKeys = {
  all: ['manager-shifts'] as const,
  overview: (day: string) => [...shiftsKeys.all, 'overview', day] as const,
  team: (day: string, type: ShiftType) => [...shiftsKeys.all, 'team', day, type] as const,
  reports: () => [...shiftsKeys.all, 'reports'] as const,
  report: (id: string) => [...shiftsKeys.all, 'report', id] as const,
  handover: (id: string) => [...shiftsKeys.all, 'handover', id] as const,
  activities: (id: string) => [...shiftsKeys.all, 'activities', id] as const,
  assignees: () => [...shiftsKeys.all, 'assignees'] as const,
};

// staleTime 0: the employees page can change who works which shift, so the data is refetched on every visit
export function useShiftsOverview() {
  const day = cairoBusinessDate();
  return useQuery({ queryKey: shiftsKeys.overview(day), queryFn: () => getShiftsOverview(day), staleTime: 0 });
}

export function useShiftTeam(shiftType: ShiftType | null) {
  const day = cairoBusinessDate();
  return useQuery({
    queryKey: shiftsKeys.team(day, shiftType ?? 'MORNING'),
    queryFn: () => getShiftTeam(day, shiftType as ShiftType),
    enabled: Boolean(shiftType),
    staleTime: 0,
  });
}

export function useShiftReports() {
  return useQuery({ queryKey: shiftsKeys.reports(), queryFn: getShiftReports, staleTime: 0 });
}

export function useShiftReport(reportId: string | null) {
  return useQuery({ queryKey: shiftsKeys.report(reportId ?? ''), queryFn: () => getShiftReport(reportId as string), enabled: Boolean(reportId) });
}

export function useShiftHandover(reportId: string | null) {
  return useQuery({ queryKey: shiftsKeys.handover(reportId ?? ''), queryFn: () => getShiftHandover(reportId as string), enabled: Boolean(reportId) });
}

export function useShiftActivities(reportId: string | null) {
  return useQuery({ queryKey: shiftsKeys.activities(reportId ?? ''), queryFn: () => getShiftActivities(reportId as string), enabled: Boolean(reportId) });
}

export function useAssignees(enabled: boolean) {
  return useQuery({ queryKey: shiftsKeys.assignees(), queryFn: getAssignees, enabled, staleTime: 0 });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: shiftsKeys.all });
}

export function useReviewReport() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ reportId, status, comment }: { reportId: string; status: Exclude<ReviewStatus, 'PENDING_REVIEW'>; comment: string }) =>
      reviewShiftReport(reportId, status, comment),
    onSuccess: () => invalidate(),
  });
}

export function useAssignShift() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ assignee, shiftType }: { assignee: Assignee; shiftType: ShiftType }) => assignShift(assignee, cairoBusinessDate(), shiftType),
    onSuccess: () => invalidate(),
  });
}

export function useCancelShift() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: cancelShift, onSuccess: () => invalidate() });
}
