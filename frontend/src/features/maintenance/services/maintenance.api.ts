import { request } from '../../../core/api/apiClient';
import type { Paginated } from '../../../core/api/api.types';
import { MT_FETCH_LIMIT } from '../constants/maintenance.constants';
import type { MaintenanceIssueCreate, MaintenanceIssueUpdate, MaintenanceRequest, RoomRef } from '../types/maintenance.types';

export async function getMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const response = await request<Paginated<MaintenanceRequest>>('/maintenance-issues', {
    params: { page: 1, limit: MT_FETCH_LIMIT },
  });
  return response.data;
}

export async function createMaintenanceRequest(body: MaintenanceIssueCreate): Promise<MaintenanceRequest> {
  return request<MaintenanceRequest>('/maintenance-issues', {
    method: 'POST',
    body,
  });
}

export async function updateMaintenanceRequest(issueId: string | number, body: MaintenanceIssueUpdate): Promise<MaintenanceRequest> {
  return request<MaintenanceRequest>(`/maintenance-issues/${issueId}`, {
    method: 'PATCH',
    body,
  });
}

/** Room numbers the receptionist can pick in the form, from GET /rooms */
export async function getRoomNumbers(): Promise<string[]> {
  const response = await request<Paginated<RoomRef>>('/rooms', {
    params: { page: 1, limit: MT_FETCH_LIMIT },
  });
  return response.data.map((room) => String(room.room_number || room.room_id));
}
