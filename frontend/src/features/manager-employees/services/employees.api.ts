import { request } from '../../../core/api/apiClient';
import type { Paginated } from '../../../core/api/api.types';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { STAFF_FETCH_LIMIT } from '../constants/employees.constants';
import type { ShiftCoverage, ShiftType, Staff, StaffCreate, StaffCreated, StaffUpdate } from '../types/employee.types';

// Manager API Contract v1.1. Served by the mocks until the backend ships (VITE_USE_MOCKS=true).

export async function getStaff(): Promise<Staff[]> {
  const response = await request<Paginated<Staff>>('/manager/staff', {
    params: { include: 'today_shift,workload', page: 1, limit: STAFF_FETCH_LIMIT },
  });
  return response.data;
}

export async function createStaff(body: StaffCreate, idempotencyKey = newIdempotencyKey()): Promise<StaffCreated> {
  const response = await request<{ data: StaffCreated }>('/manager/staff', { method: 'POST', body, idempotencyKey });
  return response.data;
}

export async function updateStaff(staffId: string, body: StaffUpdate): Promise<Staff> {
  const response = await request<{ data: Staff }>(`/manager/staff/${staffId}`, { method: 'PATCH', body });
  return response.data;
}

export async function deactivateStaff(staffId: string): Promise<void> {
  await request(`/manager/staff/${staffId}`, { method: 'DELETE' });
}

export async function reactivateStaff(staffId: string): Promise<void> {
  await request(`/manager/staff/${staffId}/reactivate`, { method: 'POST' });
}

export async function resetStaffPassword(staffId: string): Promise<string> {
  const response = await request<{ data: { temporary_password: string } }>(`/manager/staff/${staffId}/reset-password`, { method: 'POST' });
  return response.data.temporary_password;
}

/** Puts a new employee on a shift for the given business date (times are derived by the server) */
export async function scheduleShift(staffId: string, businessDate: string, shiftType: ShiftType): Promise<void> {
  await request('/manager/shifts', { method: 'POST', body: { staff_id: staffId, business_date: businessDate, shift_type: shiftType } });
}

export async function getShiftCoverage(businessDate: string): Promise<ShiftCoverage[]> {
  const response = await request<unknown>('/manager/shifts/overview', { params: { business_date: businessDate } });
  const body = response as Record<string, unknown> | unknown[] | null | undefined;

  let rawCards: Record<string, unknown>[] = [];
  if (Array.isArray(body)) {
    rawCards = body as Record<string, unknown>[];
  } else if (body && typeof body === 'object') {
    const data = (body as { data?: unknown }).data;
    if (Array.isArray(data)) {
      rawCards = data as Record<string, unknown>[];
    } else if (data && typeof data === 'object') {
      const cards = (data as { cards?: unknown }).cards;
      if (Array.isArray(cards)) {
        rawCards = cards as Record<string, unknown>[];
      }
    } else if (Array.isArray((body as { cards?: unknown }).cards)) {
      rawCards = (body as { cards: Record<string, unknown>[] }).cards;
    }
  }

  return rawCards.map((card) => {
    const rawType = String(card.shift_type || 'MORNING').toUpperCase();
    const shiftType: ShiftType = (['MORNING', 'EVENING', 'NIGHT'].includes(rawType)
      ? rawType
      : 'MORNING') as ShiftType;

    const startTime = String(card.start_time || card.start_at || '');
    const endTime = String(card.end_time || card.end_at || '');

    const rawStatus = typeof card.status === 'string' ? card.status.toUpperCase() : '';
    let status: ShiftCoverage['status'] = 'SCHEDULED';
    if (['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(rawStatus)) {
      status = rawStatus as ShiftCoverage['status'];
    } else {
      const counts = card.counts as { active?: number; completed?: number; scheduled?: number } | undefined;
      if (counts?.active && counts.active > 0) {
        status = 'ACTIVE';
      } else {
        const now = Date.now();
        const start = startTime ? new Date(startTime).getTime() : NaN;
        const end = endTime ? new Date(endTime).getTime() : NaN;
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          if (now >= start && now < end) {
            status = 'ACTIVE';
          } else if (now >= end) {
            status = 'COMPLETED';
          } else {
            status = 'SCHEDULED';
          }
        } else if (counts?.completed && counts.completed > 0 && !counts.scheduled) {
          status = 'COMPLETED';
        }
      }
    }

    let leadStaff: ShiftCoverage['staff'] = null;
    const rawStaff = card.staff;
    if (Array.isArray(rawStaff)) {
      const staffList = rawStaff as Record<string, unknown>[];
      const receptionist = staffList.find((s) => {
        const dep = String(s.department || '').toLowerCase();
        return dep === 'reception' || dep === 'front_desk';
      }) ?? staffList[0];

      if (receptionist) {
        leadStaff = {
          staff_id: String(receptionist.staff_id || receptionist.id || ''),
          full_name: String(receptionist.full_name || receptionist.staff_name || receptionist.name || ''),
        };
      }
    } else if (rawStaff && typeof rawStaff === 'object') {
      const staffObj = rawStaff as Record<string, unknown>;
      leadStaff = {
        staff_id: String(staffObj.staff_id || staffObj.id || ''),
        full_name: String(staffObj.full_name || staffObj.staff_name || staffObj.name || ''),
      };
    }

    const counts = card.counts as { active?: number; completed?: number; scheduled?: number } | undefined;
    const teamCount = typeof card.team_count === 'number'
      ? card.team_count
      : counts
        ? (counts.scheduled || 0) + (counts.active || 0) + (counts.completed || 0)
        : Array.isArray(rawStaff)
          ? rawStaff.length
          : leadStaff ? 1 : 0;

    return {
      shift_type: shiftType,
      shift_id: card.shift_id ? String(card.shift_id) : null,
      status,
      start_time: startTime,
      end_time: endTime,
      staff: leadStaff,
      team_count: teamCount,
    };
  });
}
