import { useMemo } from 'react';
import { useRoomsList } from './useRoomsList';
import { useRoomActivities } from './useRoomActivities';
import type { ManagerRoom } from '../types/manager-rooms.types';

/**
 * Hook to retrieve a single room's details and activity history.
 *
 * Requirements from Manager API Contract v1.2:
 * - Gets the selected room from the cached room list.
 * - Loads activity history from /rooms/{id}/activities.
 * - Supports direct navigation using ?id=<roomId> once the list has loaded.
 * - Does NOT implement or call GET /rooms/{id}.
 */
export function useManagerRoom(id?: string) {
  const roomsQuery = useRoomsList(1, 100);

  const selectedRoom = useMemo(() => {
    if (!id || !roomsQuery.data) return undefined;
    return roomsQuery.data.find(
      (r) => r.id === id || r.number === id
    );
  }, [id, roomsQuery.data]);

  const targetRoomId = selectedRoom?.id ?? id;
  const activitiesQuery = useRoomActivities(targetRoomId);

  const mergedRoom = useMemo<ManagerRoom | undefined>(() => {
    if (!selectedRoom) return undefined;
    return {
      ...selectedRoom,
      log: activitiesQuery.data ?? selectedRoom.log ?? [],
    };
  }, [selectedRoom, activitiesQuery.data]);

  const isLoading = roomsQuery.isLoading || (Boolean(id) && activitiesQuery.isLoading);
  const isError = roomsQuery.isError || activitiesQuery.isError;
  const error = roomsQuery.error || activitiesQuery.error;

  const refetch = async () => {
    await Promise.all([roomsQuery.refetch(), activitiesQuery.refetch()]);
  };

  return {
    data: mergedRoom,
    isLoading,
    isError,
    error,
    refetch,
    roomFound: Boolean(selectedRoom),
  };
}
