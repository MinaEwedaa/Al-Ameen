import { request } from '../../../core/api/apiClient';
import type { Paginated } from '../../../core/api/api.types';
import { HK_FETCH_LIMIT } from '../constants/housekeeping.constants';
import type { CleaningTaskCreate, CleaningTaskUpdate, HousekeepingTask, RoomRef } from '../types/housekeeping.types';

export async function getHousekeepingTasks(): Promise<HousekeepingTask[]> {
  const response = await request<Paginated<HousekeepingTask>>('/cleaning-tasks', {
    params: { page: 1, limit: HK_FETCH_LIMIT },
  });
  return response.data;
}

export async function createHousekeepingTask(body: CleaningTaskCreate): Promise<HousekeepingTask> {
  return request<HousekeepingTask>('/cleaning-tasks', {
    method: 'POST',
    body,
  });
}

export async function updateHousekeepingTask(taskId: string | number, body: CleaningTaskUpdate): Promise<HousekeepingTask> {
  return request<HousekeepingTask>(`/cleaning-tasks/${taskId}`, {
    method: 'PATCH',
    body,
  });
}

/** Room numbers the receptionist can pick in the form, from GET /rooms */
export async function getRoomNumbers(): Promise<string[]> {
  const response = await request<Paginated<RoomRef>>('/rooms', {
    params: { page: 1, limit: HK_FETCH_LIMIT },
  });
  return response.data.map((room) => String(room.room_number || room.room_id));
}
