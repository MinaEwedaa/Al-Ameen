import { request } from '../../../core/api/apiClient';
import type { RoomType, RoomTypeUpdate } from '../types/roomType.types';

// Manager API Contract v1.1. Served by the mocks until the backend ships (VITE_USE_MOCKS=true).

export async function getRoomTypes(): Promise<RoomType[]> {
  const response = await request<{ data: RoomType[] }>('/room-types');
  return response.data;
}

export async function updateRoomType(id: string, body: RoomTypeUpdate): Promise<RoomType> {
  const response = await request<{ data: RoomType }>(`/room-types/${id}`, { method: 'PATCH', body });
  return response.data;
}

/** "تحديث الأسعار" saves every changed base price; the contract has no bulk endpoint */
export async function updateBasePrices(prices: Array<{ id: string; base_price: number }>): Promise<RoomType[]> {
  return Promise.all(prices.map(({ id, base_price }) => updateRoomType(id, { base_price })));
}
