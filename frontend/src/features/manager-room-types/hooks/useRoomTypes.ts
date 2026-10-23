import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoomTypes, updateBasePrices, updateRoomType } from '../services/roomTypes.api';
import type { RoomType, RoomTypeUpdate } from '../types/roomType.types';

export const roomTypesKeys = {
  all: ['manager-room-types'] as const,
  list: () => [...roomTypesKeys.all, 'list'] as const,
};

export function useRoomTypes() {
  return useQuery({ queryKey: roomTypesKeys.list(), queryFn: getRoomTypes });
}

function mergeSaved(current: RoomType[] | undefined, saved: RoomType[]) {
  return current?.map((type) => saved.find((item) => item.room_type_id === type.room_type_id) ?? type);
}

// Both mutations write the server answer into the cache, so the cards update immediately
export function useUpdateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RoomTypeUpdate }) => updateRoomType(id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData<RoomType[]>(roomTypesKeys.list(), (current) => mergeSaved(current, [saved]));
      void queryClient.invalidateQueries({ queryKey: roomTypesKeys.all });
    },
  });
}

export function useUpdateBasePrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBasePrices,
    onSuccess: (saved) => {
      queryClient.setQueryData<RoomType[]>(roomTypesKeys.list(), (current) => mergeSaved(current, saved));
      void queryClient.invalidateQueries({ queryKey: roomTypesKeys.all });
    },
  });
}
