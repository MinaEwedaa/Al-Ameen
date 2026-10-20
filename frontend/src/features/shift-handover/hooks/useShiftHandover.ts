import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getShiftSummary,
  submitShiftHandover,
} from '../services/shift-handover.api';

export const shiftSummaryKey = ['shift-handover', 'summary'] as const;

// enabled=false بعد التسليم: الملخص بيفضل معروض من الكاش بدل ما يرجع 404
export function useShiftSummary(enabled: boolean) {
  return useQuery({
    queryKey: shiftSummaryKey,
    queryFn: getShiftSummary,
    enabled,
  });
}

export function useHandoverShift() {
  return useMutation({ mutationFn: submitShiftHandover });
}