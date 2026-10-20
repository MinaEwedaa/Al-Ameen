export const ROOM_STATUS = {
  available: 'Available',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
} as const;

export type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];
