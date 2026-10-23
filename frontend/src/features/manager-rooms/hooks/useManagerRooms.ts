import { useMemo } from 'react';
import { useRoomsList } from './useRoomsList';
import type { ManagerRoom } from '../types/manager-rooms.types';

export function useManagerRooms(floor?: number) {
  const query = useRoomsList(1, 100);

  const filteredData = useMemo<ManagerRoom[] | undefined>(() => {
    if (!query.data) return undefined;
    if (floor === undefined || floor === null) return query.data;
    return query.data.filter((r) => r.floor === floor);
  }, [query.data, floor]);

  return {
    ...query,
    data: filteredData,
    allRooms: query.data,
  };
}
