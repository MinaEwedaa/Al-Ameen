import { request } from '../../../core/api/apiClient';
import type {
  HandoverRequest,
  Shift,
  ShiftSummary,
} from '../types/shift-handover.types';

export function getShiftSummary(): Promise<ShiftSummary> {
  return request<ShiftSummary>('/shifts/current/summary');
}

export function submitShiftHandover(data: HandoverRequest): Promise<Shift> {
  return request<Shift>('/shifts/current/handover', {
    method: 'PATCH',
    body: data,
  });
}

export function getShiftReport(shiftId: string): Promise<Blob> {
  return request<Blob>(`/shifts/${shiftId}/report`, { responseType: 'blob' });
}