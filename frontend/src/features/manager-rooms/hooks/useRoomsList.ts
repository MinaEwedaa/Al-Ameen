import { useQuery } from '@tanstack/react-query';
import { getRooms, managerRoomsQueryKeys } from '../services/manager-rooms.api';
import { mapRoomDtoToManagerRoom } from '../services/manager-rooms.mappers';
import type { ManagerRoom } from '../types/manager-rooms.types';

export function useRoomsList(page = 1, limit = 100) {
  return useQuery({
    queryKey: managerRoomsQueryKeys.list({ page, limit }),
    queryFn: () => getRooms(page, limit),
    select: (res): ManagerRoom[] => {
      const items = Array.isArray(res)
        ? res
        : res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)
        ? res.data
        : [];
      return items.map((dto) => mapRoomDtoToManagerRoom(dto));
    },
  });
}
