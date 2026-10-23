import { request } from '../../../core/api/apiClient';
import type { Paginated } from '../../../core/api/api.types';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { STAFF_FETCH_LIMIT } from '../constants/employees.constants';
import type { ShiftCoverage, ShiftType, Staff, StaffCreate, StaffCreated, StaffUpdate } from '../types/employee.types';

// Manager API Contract v1.1. Served by the mocks until the backend ships (VITE_USE_MOCKS=true).

export async function getStaff(): Promise<Staff[]> {
  const response = await request<Paginated<Staff>>('/staff', {
    params: { include: 'today_shift,workload', page: 1, limit: STAFF_FETCH_LIMIT },
  });
  return response.data;
}

export async function createStaff(body: StaffCreate, idempotencyKey = newIdempotencyKey()): Promise<StaffCreated> {
  const response = await request<{ data: StaffCreated }>('/staff', { method: 'POST', body, idempotencyKey });
  return response.data;
}

export async function updateStaff(staffId: string, body: StaffUpdate): Promise<Staff> {
  const response = await request<{ data: Staff }>(`/staff/${staffId}`, { method: 'PATCH', body });
  return response.data;
}

export async function deactivateStaff(staffId: string): Promise<void> {
  await request(`/staff/${staffId}`, { method: 'DELETE' });
}

export async function reactivateStaff(staffId: string): Promise<void> {
  await request(`/staff/${staffId}/reactivate`, { method: 'POST' });
}

export async function resetStaffPassword(staffId: string): Promise<string> {
  const response = await request<{ data: { temporary_password: string } }>(`/staff/${staffId}/reset-password`, { method: 'POST' });
  return response.data.temporary_password;
}

/** Puts a new employee on a shift for the given business date (times are derived by the server) */
export async function scheduleShift(staffId: string, businessDate: string, shiftType: ShiftType): Promise<void> {
  await request('/shifts', { method: 'POST', body: { staff_id: staffId, business_date: businessDate, shift_type: shiftType } });
}

export async function getShiftCoverage(businessDate: string): Promise<ShiftCoverage[]> {
  const response = await request<{ data: ShiftCoverage[] }>('/shifts/overview', { params: { business_date: businessDate } });
  return response.data.map(({ shift_type, shift_id, status, start_time, end_time, staff, team_count }) => (
    { shift_type, shift_id, status, start_time, end_time, staff, team_count }
  ));
}
