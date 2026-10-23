import { useQuery } from '@tanstack/react-query';
import {
  getRoomActivities,
  managerRoomsQueryKeys,
} from '../services/manager-rooms.api';
import { mapRoomActivitiesDto } from '../services/manager-rooms.mappers';
import type { RoomLogItem } from '../types/manager-rooms.types';

export function useRoomActivities(roomId?: string) {
  return useQuery({
    queryKey: managerRoomsQueryKeys.activities(roomId ?? ''),
    queryFn: () => getRoomActivities(roomId!),
    enabled: Boolean(roomId),
    select: (res): RoomLogItem[] => mapRoomActivitiesDto(res),
  });
}
