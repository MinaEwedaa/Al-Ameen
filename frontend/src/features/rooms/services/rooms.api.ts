import { request } from '../../../core/api/apiClient';
import type { Language } from '../../../core/i18n';
import type { Paginated } from '../../../core/api/api.types';
import type { AddRoomActivityInput, Room, RoomFilters, RoomFloor, RoomStats, RoomStatus, UpdateRoomInput } from '../types/room.types';
import { filterAndSortRooms } from '../utils/roomDisplay';

export interface RoomListResult {
  rows: Room[];
  matchingRooms: Room[];
  total: number;
}

export const roomQueryKeys = {
  all: ['rooms'] as const,
  base: () => [...roomQueryKeys.all, 'base'] as const,
  lists: () => [...roomQueryKeys.all, 'list'] as const,
  list: (filters: RoomFilters, language: Language) => [...roomQueryKeys.lists(), filters, language] as const,
  stats: () => [...roomQueryKeys.all, 'stats'] as const,
  detail: (id: string) => [...roomQueryKeys.all, 'detail', id] as const,
};

const ROOM_FETCH_LIMIT = 100;

interface ApiRoom {
  room_id: string;
  room_number: string;
  floor: number | null;
  room_type: string;
  status: RoomStatus;
  description: string;
  price_per_night: number;
  half_day_price: number;
  current_guest_name: string | null;
  view: Room['view'] | null;
  updated_at: string | null;
}

interface ApiRoomStatusHistory {
  history_id: string;
  room_id: string;
  status: RoomStatus;
  notes: string | null;
  changed_at: string;
  shift_id: string | null;
}

function mapApiRoom(room: ApiRoom): Room {
  // floor now comes from the backend; values outside 1-3 fall back to 1 until RoomFloor is widened.
  const floor = (room.floor !== null && room.floor >= 1 && room.floor <= 3 ? room.floor : 1) as RoomFloor;

  return {
    id: room.room_id,
    number: room.room_number,
    // TODO: confirm with backend; single/double do not define VIP, so non-VIP is a safe guess.
    type: room.room_type.toLowerCase() === 'vip' ? 'vip' : 'standard',
    status: room.status,
    floor,
    view: room.view ?? 'city',
    guestName: room.current_guest_name ?? undefined,
    notes: room.description,
    updatedAt: room.updated_at ?? '',
    log: [],
  };
}
function mapStatusHistory(row: ApiRoomStatusHistory) {
  return {
    id: String(row.history_id),
    titleKey: `rooms.status.${row.status}`,
    descriptionKey: row.notes ?? '—',
    time: row.changed_at,
  };
  
}

export async function getRooms(): Promise<Room[]> {
  const response = await request<Paginated<ApiRoom>>('/rooms', {
    params: { page: 1, limit: ROOM_FETCH_LIMIT },
  });
  return response.data.map(mapApiRoom);
}

export async function listRooms(filters: RoomFilters, language: Language, pageSize: number): Promise<RoomListResult> {
  const matchingRooms = filterAndSortRooms(await getRooms(), filters, language);
  const start = (filters.page - 1) * pageSize;
  return {
    rows: matchingRooms.slice(start, start + pageSize),
    matchingRooms,
    total: matchingRooms.length,
  };
}

export async function getRoom(id: string): Promise<Room | undefined> {
  const room = (await getRooms()).find((item) => item.id === id);
  if (!room) return undefined;

  const history = await request<Paginated<ApiRoomStatusHistory>>(`/rooms/${room.id}/status-history`, {
    params: { page: 1, limit: ROOM_FETCH_LIMIT },
  });
  return { ...room, log: history.data.map(mapStatusHistory) };
}

export async function getRoomStats(): Promise<RoomStats> {
  const rooms = await getRooms();
  return {
    total: rooms.length,
    available: rooms.filter((room) => room.status === 'available').length,
    occupied: rooms.filter((room) => room.status === 'occupied').length,
    cleaning: rooms.filter((room) => room.status === 'cleaning').length,
    maintenance: rooms.filter((room) => room.status === 'maintenance').length,
    vip: rooms.filter((room) => room.type === 'vip').length,
  };

}

export async function saveRoom(input: UpdateRoomInput): Promise<ApiRoomStatusHistory> {
  return request<ApiRoomStatusHistory>(`/rooms/${input.id}/status`, {
    method: 'PATCH',
    body: { status: input.status, notes: input.notes },
  });
}

export async function saveRoomActivity(input: AddRoomActivityInput): Promise<ApiRoomStatusHistory> {
  // TODO: confirm with backend; guestName is not accepted by PATCH /rooms/{room_id}/status.
  return saveRoom({ id: input.roomId, status: input.status, notes: input.notes });
}
