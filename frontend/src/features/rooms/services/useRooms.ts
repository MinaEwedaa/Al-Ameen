import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoom, getRooms, roomQueryKeys, saveRoom, saveRoomActivity } from './rooms.api';
import type { RoomFilters, UpdateRoomInput, AddRoomActivityInput } from '../types/room.types';
import type { Language } from '../../../core/i18n';
import { ROOM_PAGE_SIZE } from '../constants/roomOptions';

import { filterAndSortRooms } from '../utils/roomDisplay';

export function useRooms(filters: RoomFilters, language: Language) {
  return useQuery({
    queryKey: roomQueryKeys.base(),
    queryFn: getRooms,
    select: (rooms) => {
      const matchingRooms = filterAndSortRooms(rooms, filters, language);
      const start = (filters.page - 1) * ROOM_PAGE_SIZE;
      return {
        rows: matchingRooms.slice(start, start + ROOM_PAGE_SIZE),
        matchingRooms,
        total: matchingRooms.length,
      };
    },
  });
}

export function useAllRooms() {
  return useQuery({ queryKey: roomQueryKeys.base(), queryFn: getRooms });
}

export function useRoom(id: string | undefined) {
  return useQuery({
    queryKey: roomQueryKeys.detail(id ?? ''),
    queryFn: () => getRoom(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useRoomStats() {
  return useQuery({
    queryKey: roomQueryKeys.base(),
    queryFn: getRooms,
    select: (rooms) => ({
      total: rooms.length,
      available: rooms.filter((room) => room.status === 'available').length,
      occupied: rooms.filter((room) => room.status === 'occupied').length,
      cleaning: rooms.filter((room) => room.status === 'cleaning').length,
      maintenance: rooms.filter((room) => room.status === 'maintenance').length,
      vip: rooms.filter((room) => room.type === 'vip').length,
    }),
  });
}

function useRoomMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: roomQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: roomQueryKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: roomQueryKeys.all }),
      ]);
    },
  });
}

export function useUpdateRoom() {
  return useRoomMutation<UpdateRoomInput>(saveRoom);
}

export function useAddRoomActivity() {
  return useRoomMutation<AddRoomActivityInput>(saveRoomActivity);
}
