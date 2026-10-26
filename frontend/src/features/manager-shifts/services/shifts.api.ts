import { request } from '../../../core/api/apiClient';
import type { Paginated } from '../../../core/api/api.types';
import { REPORTS_FETCH_LIMIT, STAFF_FETCH_LIMIT } from '../constants/shifts.constants';
import type {
  Assignee,
  ReviewStatus,
  ShiftActivity,
  ShiftEntry,
  ShiftHandover,
  ShiftOverview,
  ShiftReport,
  ShiftReportDetail,
  ShiftType,
} from '../types/shift.types';

// Manager API Contract v1.1. Served by the mocks until the backend ships (VITE_USE_MOCKS=true).

export async function getShiftsOverview(businessDate: string): Promise<ShiftOverview[]> {
  const response = await request<{ data: ShiftOverview[] | { cards: ShiftOverview[] } }>('/shifts/overview', { params: { business_date: businessDate } });
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && typeof rawData === 'object' && 'cards' in rawData && Array.isArray(rawData.cards)) {
    return rawData.cards;
  }
  return [];
}

export async function getShiftTeam(businessDate: string, shiftType: ShiftType): Promise<ShiftEntry[]> {
  const response = await request<Paginated<ShiftEntry>>('/shifts', {
    params: { business_date: businessDate, shift_type: shiftType, page: 1, limit: STAFF_FETCH_LIMIT },
  });
  return response.data;
}

export async function cancelShift(shiftId: string): Promise<void> {
  await request(`/shifts/${shiftId}`, { method: 'DELETE' });
}

export async function getShiftReports(): Promise<ShiftReport[]> {
  const response = await request<Paginated<ShiftReport>>('/shift-reports', { params: { page: 1, limit: REPORTS_FETCH_LIMIT } });
  return response.data;
}

export async function getShiftReport(reportId: string): Promise<ShiftReportDetail> {
  const response = await request<{ data: ShiftReportDetail }>(`/shift-reports/${reportId}`);
  return response.data;
}

export async function getShiftHandover(reportId: string): Promise<ShiftHandover> {
  const response = await request<{ data: ShiftHandover }>(`/shift-reports/${reportId}/handover`);
  return response.data;
}

export async function getShiftActivities(reportId: string): Promise<ShiftActivity[]> {
  const response = await request<{ data: ShiftActivity[] }>(`/shift-reports/${reportId}/activities`);
  return response.data;
}

export async function reviewShiftReport(reportId: string, reviewStatus: Exclude<ReviewStatus, 'PENDING_REVIEW'>, comment: string): Promise<ShiftReport> {
  const response = await request<{ data: ShiftReport }>(`/shift-reports/${reportId}/review`, {
    method: 'PATCH',
    body: { review_status: reviewStatus, ...(comment ? { manager_comment: comment } : {}) },
  });
  return response.data;
}

export async function getAssignees(): Promise<Assignee[]> {
  const response = await request<Paginated<Assignee>>('/staff', {
    params: { include: 'today_shift', is_active: true, page: 1, limit: STAFF_FETCH_LIMIT },
  });
  return response.data.map(({ staff_id, full_name, staff_type, is_active, today_shift }) => ({
    staff_id,
    full_name,
    staff_type,
    is_active,
    today_shift: today_shift ? { shift_id: today_shift.shift_id, shift_type: today_shift.shift_type, status: today_shift.status } : null,
  }));
}

/**
 * Moves an employee to another shift today: a new shift when they have none,
 * otherwise their SCHEDULED shift is changed (the server refuses one that already started).
 */
export async function assignShift(assignee: Assignee, businessDate: string, shiftType: ShiftType): Promise<void> {
  if (!assignee.today_shift) {
    await request('/shifts', { method: 'POST', body: { staff_id: assignee.staff_id, business_date: businessDate, shift_type: shiftType } });
    return;
  }
  await request(`/shifts/${assignee.today_shift.shift_id}`, { method: 'PATCH', body: { shift_type: shiftType } });
}
