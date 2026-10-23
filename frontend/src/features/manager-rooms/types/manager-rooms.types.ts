// Manager Rooms Types
// Derived from Figma design slices: 2_ManagerRoomManagement_01.jpg, _02.jpg, 2_1_ManagerRoomManagement_01.jpg

export type RoomType = 'standard' | 'vip';

export type RoomStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';

export interface RoomLogItem {
  id: string;
  action: string;
  time: string;
  details: string;
  // TODO confirm with backend - operational history schema and audit trail fields
}

export interface ManagerRoom {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  status: RoomStatus;
  price: number;
  guestName?: string;
  log: RoomLogItem[];
  // TODO confirm with backend - room metadata, capacity, and amenities
}

export interface ManagerRoomsStats {
  totalRooms: number;
  standardRooms: number;
  vipRooms: number;
  totalFloors: number;
  floorOccupancy: Record<number, number>; // floor -> occupancy %
  statusCounts: {
    available: number;
    occupied: number;
    reserved: number;
    cleaning: number;
    maintenance: number;
  };
  // TODO confirm with backend - stats calculation endpoints and caching strategy
}

export interface ManagerRoomsFilterParams {
  floor?: number;
  status?: RoomStatus | 'all';
  type?: RoomType | 'all';
  search?: string;
  // TODO confirm with backend - query parameter naming and pagination
}
