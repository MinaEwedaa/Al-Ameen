export type RoomType = 'standard' | 'vip';
export type RoomStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';
export type RoomFloor = 1 | 2 | 3;
export type RoomAvailability = 'all' | 'available' | 'unavailable';

export interface RoomLogEntry {
  id: string;
  titleKey: string;
  descriptionKey: string;
  time: string;
}

export interface Room {
  id: string;
  number: string;
  type: RoomType; // TODO: confirm with backend
  status: RoomStatus; // TODO: confirm with backend
  floor: RoomFloor; // TODO: confirm with backend
  view: 'nile' | 'garden' | 'city'; // TODO: confirm with backend
  guestName?: string;
  guestNameKey?: string;
  arrivalDate?: string;
  notes: string;
  notesKey?: string;
  updatedAt: string;
  log: RoomLogEntry[];
}

export interface RoomFilters {
  q: string;
  type: RoomType | '';
  status: RoomStatus | '';
  floor: RoomFloor | '';
  availability: RoomAvailability;
  page: number;
}

export interface RoomStats {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  maintenance: number;
  vip: number;
}

export interface UpdateRoomInput {
  id: string;
  status: RoomStatus;
  notes: string;
}

export interface AddRoomActivityInput {
  roomId: string;
  status: RoomStatus;
  guestName: string;
  notes: string;
}
