import type { RoomStatus } from '../types/room.types';

export interface RoomActivityFormValues {
  roomId: string;
  status: RoomStatus | '';
  guestName: string;
}

export interface RoomActivityErrors {
  roomId?: string;
  status?: string;
  guestName?: string;
}

export function validateRoomActivity(values: RoomActivityFormValues, messages: { room: string; status: string; guest: string }): RoomActivityErrors {
  const errors: RoomActivityErrors = {};
  if (!values.roomId) errors.roomId = messages.room;
  if (!values.status) errors.status = messages.status;
  if ((values.status === 'occupied' || values.status === 'reserved') && !values.guestName.trim()) errors.guestName = messages.guest;
  return errors;
}
