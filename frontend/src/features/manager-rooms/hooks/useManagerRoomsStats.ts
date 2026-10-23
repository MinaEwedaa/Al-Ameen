import { useMemo } from 'react';
import { useRoomsList } from './useRoomsList';
import { computeRoomsStats } from '../services/manager-rooms.mappers';
import type { ManagerRoomsStats } from '../types/manager-rooms.types';

export function useManagerRoomsStats() {
  const query = useRoomsList(1, 100);

  const stats = useMemo<ManagerRoomsStats | undefined>(() => {
    if (!query.data) return undefined;
    return computeRoomsStats(query.data);
  }, [query.data]);

  return {
    ...query,
    data: stats,
  };
}
