// Pure DTO-to-UI Mapping Functions for Manager Rooms
// Follows Manager API Contract v1.2

import type {
  RoomDto,
  RoomActivityDto,
  RoomPhysicalStatusEnum,
  RoomOccupancyStatusEnum,
  RoomActivitiesResponseDto,
} from '../types/manager-rooms.dto';

import type {
  ManagerRoom,
  ManagerRoomsStats,
  RoomStatus,
  RoomType,
  RoomLogItem,
} from '../types/manager-rooms.types';
import { formatClock } from '../../../utils/format';

/**
 * Derives the single UI RoomStatus from physical_status and occupancy_status.
 *
 * Implements the exact precedence from Manager API Contract v1.2:
 * 1. physical_status is MAINTENANCE or OUT_OF_SERVICE -> 'maintenance'
 * 2. Otherwise, occupancy_status is OCCUPIED -> 'occupied'
 * 3. Otherwise, occupancy_status is RESERVED -> 'reserved'
 * 4. Otherwise, physical_status is DIRTY -> 'cleaning'
 * 5. Otherwise -> 'available'
 *
 * Assumption: Room status derivation precedence matches contract extract v1.2.
 * // TODO confirm with backend
 */
export function deriveRoomDisplayStatus(room: {
  physical_status?: RoomPhysicalStatusEnum | string;
  occupancy_status?: RoomOccupancyStatusEnum | string;
}): RoomStatus {
  const pStatus = (room.physical_status ?? '').toUpperCase();
  const oStatus = (room.occupancy_status ?? '').toUpperCase();

  if (pStatus === 'MAINTENANCE' || pStatus === 'OUT_OF_SERVICE') {
    return 'maintenance';
  }
  if (oStatus === 'OCCUPIED') {
    return 'occupied';
  }
  if (oStatus === 'RESERVED') {
    return 'reserved';
  }
  if (pStatus === 'DIRTY') {
    return 'cleaning';
  }
  return 'available';
}

/**
 * Maps raw RoomActivityDto array (or paginated envelope) to UI RoomLogItem array.
 */
export function mapRoomActivitiesDto(
  raw?: RoomActivitiesResponseDto | null
): RoomLogItem[] {
  if (!raw) return [];
  const items: RoomActivityDto[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: RoomActivityDto[] }).data)
    ? (raw as { data: RoomActivityDto[] }).data
    : [];

  return items.map((item) => {
    let formattedTime = item.time;
    if (item.time && item.time.includes('T')) {
      const d = new Date(item.time);
      if (!isNaN(d.getTime())) {
        formattedTime = formatClock(d, 'ar');
      }
    }
    return {
      id: item.id,
      action: item.action,
      time: formattedTime,
      details: item.details || item.performed_by || '',
    };
  });
}

/**
 * Maps raw RoomDto to UI ManagerRoom model.
 * Inferred field names (room_number, floor, room_type, rack_rate, current_guest)
 * are mapped here and marked TODO confirm with backend.
 */
export function mapRoomDtoToManagerRoom(
  dto: RoomDto,
  activities?: RoomActivitiesResponseDto
): ManagerRoom {
  const status = deriveRoomDisplayStatus(dto);

  // Inferred room_type: check if 'vip' is in string, otherwise default to 'standard'
  // TODO confirm with backend: room_type enum vs string values
  const type: RoomType =
    (dto.room_type_name ?? dto.room_type ?? '').toLowerCase().includes('vip') ? 'vip' : 'standard';

  // Inferred floor: derive from floor field or first digit of room number
  // TODO confirm with backend: floor schema representation
  let floor = dto.floor ?? null;
  if (floor === null || floor === undefined || floor < 1 || floor > 3) {
    const parsed = parseInt(String(dto.room_number || '').charAt(0), 10);
    floor = [1, 2, 3].includes(parsed) ? parsed : 1;
  }

  // Inferred rack_rate / price
  // TODO confirm with backend: pricing field name (rack_rate vs price_per_night vs price)
  const price =
    dto.price_per_night ?? dto.rack_rate ?? dto.price ?? (type === 'vip' ? 850 : 300);

  // Inferred guest name
  // TODO confirm with backend: guest name property (current_guest vs current_guest_name)
  const guestName =
    dto.current_guest_name ?? dto.current_guest ?? dto.guest_name ?? undefined;

  const log = mapRoomActivitiesDto(activities);

  return {
    id: dto.room_id || dto.id || String(dto.room_number),
    number: String(dto.room_number || ''),
    floor,
    type,
    status,
    price,
    guestName: guestName || undefined,
    log,
  };
}

/**
 * Computes hotel and per-floor statistics from a list of ManagerRoom items.
 * Uses deriveRoomDisplayStatus-derived statuses consistently.
 */
export function computeRoomsStats(rooms: ManagerRoom[]): ManagerRoomsStats {
  const totalRooms = rooms.length;
  const standardRooms = rooms.filter((r) => r.type === 'standard').length;
  const vipRooms = rooms.filter((r) => r.type === 'vip').length;

  const statusCounts = {
    available: 0,
    occupied: 0,
    reserved: 0,
    cleaning: 0,
    maintenance: 0,
  };

  const floorCounts: Record<number, { total: number; occupied: number }> = {
    1: { total: 0, occupied: 0 },
    2: { total: 0, occupied: 0 },
    3: { total: 0, occupied: 0 },
  };

  for (const r of rooms) {
    if (statusCounts[r.status] !== undefined) {
      statusCounts[r.status]++;
    }
    const fl = r.floor;
    if (floorCounts[fl]) {
      floorCounts[fl].total++;
      if (r.status === 'occupied' || r.status === 'reserved') {
        floorCounts[fl].occupied++;
      }
    }
  }

  const floorOccupancy: Record<number, number> = {
    1: floorCounts[1].total > 0
      ? Math.round((floorCounts[1].occupied / floorCounts[1].total) * 100)
      : 0,
    2: floorCounts[2].total > 0
      ? Math.round((floorCounts[2].occupied / floorCounts[2].total) * 100)
      : 0,
    3: floorCounts[3].total > 0
      ? Math.round((floorCounts[3].occupied / floorCounts[3].total) * 100)
      : 0,
  };

  return {
    totalRooms,
    standardRooms,
    vipRooms,
    totalFloors: 3,
    floorOccupancy,
    statusCounts,
  };
}
