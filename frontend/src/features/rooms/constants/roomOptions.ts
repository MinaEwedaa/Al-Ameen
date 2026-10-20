import type { RoomAvailability, RoomFloor, RoomStatus, RoomType } from '../types/room.types';

export interface RoomOption<T extends string | number> {
  value: T;
  labelKey: string;
}

export const ROOM_TYPE_OPTIONS: RoomOption<RoomType | ''>[] = [
  { value: '', labelKey: 'rooms.options.all' },
  { value: 'standard', labelKey: 'rooms.options.type.standard' },
  { value: 'vip', labelKey: 'rooms.options.type.vip' },
];

export const ROOM_STATUS_OPTIONS: RoomOption<RoomStatus | ''>[] = [
  { value: '', labelKey: 'rooms.options.all' },
  { value: 'available', labelKey: 'rooms.options.status.available' },
  { value: 'reserved', labelKey: 'rooms.options.status.reserved' },
  { value: 'occupied', labelKey: 'rooms.options.status.occupied' },
  { value: 'cleaning', labelKey: 'rooms.options.status.cleaning' },
  { value: 'maintenance', labelKey: 'rooms.options.status.maintenance' },
];

export const ROOM_STATUS_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
  reserved: [],
  occupied: [],
};

export const ROOM_FLOOR_OPTIONS: RoomOption<RoomFloor | ''>[] = [
  { value: '', labelKey: 'rooms.options.all' },
  { value: 1 as RoomFloor, labelKey: 'rooms.options.floor.1' },
  { value: 2 as RoomFloor, labelKey: 'rooms.options.floor.2' },
  { value: 3 as RoomFloor, labelKey: 'rooms.options.floor.3' },
];

export const ROOM_AVAILABILITY_OPTIONS: RoomOption<RoomAvailability>[] = [
  { value: 'all', labelKey: 'rooms.options.all' },
  { value: 'available', labelKey: 'rooms.options.availability.available' },
  { value: 'unavailable', labelKey: 'rooms.options.availability.unavailable' },
];

export const ROOM_PAGE_SIZE = 6;
