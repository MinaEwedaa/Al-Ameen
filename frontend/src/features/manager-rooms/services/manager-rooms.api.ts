// Manager Rooms API Service
// Implements exact GET endpoints from Manager API Contract v1.2:
// - GET /rooms?page=1&limit=100
// - GET /rooms/{id}/activities
// Note: Per contract rules, GET /rooms/{id} is NOT implemented. Read-only page.

import { request } from '../../../core/api/apiClient';
import type {
  RoomListResponseDto,
  RoomActivitiesResponseDto,
} from '../types/manager-rooms.dto';

export const managerRoomsQueryKeys = {
  all: ['manager-rooms'] as const,
  list: (params: { page: number; limit: number } = { page: 1, limit: 100 }) =>
    [...managerRoomsQueryKeys.all, 'list', params] as const,
  activities: (roomId: string) =>
    [...managerRoomsQueryKeys.all, 'activities', roomId] as const,
};

/**
 * GET /rooms?page=1&limit=100
 * Fetches paginated room list envelope.
 */
export async function getRooms(
  page = 1,
  limit = 100
): Promise<RoomListResponseDto> {
  return request<RoomListResponseDto>(`/manager/rooms?page=${page}&limit=${limit}`);
}

/**
 * GET /manager/rooms/{id}/activities
 * Fetches operational activity history for a specific room.
 */
export async function getRoomActivities(
  id: string
): Promise<RoomActivitiesResponseDto> {
  return request<RoomActivitiesResponseDto>(
    `/manager/rooms/${encodeURIComponent(id)}/activities`
  );
}
