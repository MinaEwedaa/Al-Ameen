// Manager Rooms Raw API DTOs & Response Envelopes
// Based on Manager API Contract v1.2

import type { Paginated } from '../../../core/api/api.types';

// ===================== CONFIRMED CONTRACT ENUMS =====================

/**
 * Physical status enum confirmed in Manager API Contract v1.2.
 */
export type RoomPhysicalStatusEnum =
  | 'CLEAN'
  | 'DIRTY'
  | 'INSPECTED'
  | 'MAINTENANCE'
  | 'OUT_OF_SERVICE';

/**
 * Occupancy status enum confirmed in Manager API Contract v1.2.
 */
export type RoomOccupancyStatusEnum =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED';

// ===================== 1. GET /rooms?page=1&limit=100 =====================

export interface RoomDto {
  id?: string; // TODO confirm with backend (id vs room_id)
  room_number: string; // TODO confirm with backend
  floor?: number | null; // TODO confirm with backend
  room_type?: string; // TODO confirm with backend (standard / vip / single / double)
  physical_status: RoomPhysicalStatusEnum; // Confirmed contract field
  occupancy_status: RoomOccupancyStatusEnum; // Confirmed contract field
  rack_rate?: number; // TODO confirm with backend (rack_rate vs price_per_night vs price)
  price?: number; // TODO confirm with backend fallback
  current_guest?: string | null; // TODO confirm with backend (current_guest vs current_guest_name)
  guest_name?: string | null; // TODO confirm with backend fallback
  // Contract field names (v1.1 §10.2 example, v1.2 §11.2); read first by the mapper
  room_id?: string;
  room_type_id?: string;
  room_type_name?: string;
  price_per_night?: number;
  current_guest_name?: string | null;
}

export interface ManagerListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages?: number;
}

export interface RoomListResponseDto {
  data: RoomDto[];
  meta: ManagerListMeta;
}

// ===================== 2. GET /rooms/{id}/activities =====================

export interface RoomActivityDto {
  id: string; // TODO confirm with backend
  action: string; // e.g. "تحديث حالة الغرفة", "بدأ التنظيف" // TODO confirm with backend
  time: string; // e.g. "11:42 ص" // TODO confirm with backend
  details?: string; // TODO confirm with backend
  performed_by?: string; // TODO confirm with backend
}

export type RoomActivitiesResponseDto = RoomActivityDto[] | Paginated<RoomActivityDto>;
