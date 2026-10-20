import type { AddRoomActivityInput, Room, RoomLogEntry, RoomStats, RoomStatus, UpdateRoomInput } from '../features/rooms/types/room.types';
import { appendShiftActivity } from './data/shiftActivity';

const statusByNumber: Record<string, RoomStatus> = {
  '101': 'available', '102': 'available', '103': 'available', '105': 'available', '106': 'available', '107': 'available', '109': 'available',
  '104': 'occupied', '312': 'occupied',
  '207': 'cleaning', '202': 'cleaning',
  '305': 'maintenance', '303': 'maintenance',
  '208': 'reserved', '201': 'reserved',
};

const vipNumbers = new Set(['104', '108', '112', '203', '206', '208', '211', '212', '302', '304', '307', '309', '310', '311', '312']);
const firstPageMinutes = new Map<string, number>([
  ['101', 12], ['104', 28], ['207', 34], ['208', 41], ['305', 60], ['312', 120],
]);
const firstPageNotes: Record<string, string> = {
  '101': 'جاهزة لوصول الضيف',
  '104': 'ضيف مميز · VIP',
  '207': 'تنظيف بعد المغادرة',
  '208': 'وصول الساعة ٣:٠٠ م',
  '305': 'فحص المروحة',
  '312': 'مغادرة متأخرة',
};

function roomLog(number: string, updatedAt: string): RoomLogEntry[] {
  const labels: Record<string, { titleKey: string; descriptionKey: string }> = {
    '101': { titleKey: 'rooms.log.statusUpdate', descriptionKey: 'rooms.log.ready' },
    '104': { titleKey: 'rooms.log.checkIn', descriptionKey: 'rooms.log.guestCheckedIn' },
    '207': { titleKey: 'rooms.log.cleaningStarted', descriptionKey: 'rooms.log.cleaningAssigned' },
    '208': { titleKey: 'rooms.log.reservationConfirmed', descriptionKey: 'rooms.log.reservationSaved' },
    '305': { titleKey: 'rooms.log.maintenance', descriptionKey: 'rooms.log.fanInspection' },
    '312': { titleKey: 'rooms.log.checkOut', descriptionKey: 'rooms.log.lateDeparture' },
  };
  const entry = labels[number] ?? { titleKey: 'rooms.log.statusUpdate', descriptionKey: 'rooms.log.updated' };
  return [{ id: `seed-${number}`, ...entry, time: updatedAt }];
}

function createRoom(number: number, index: number): Room {
  const roomNumber = String(number);
  const floor = Math.floor(number / 100) as Room['floor'];
  const status = statusByNumber[roomNumber] ?? 'occupied';
  const minutesAgo = firstPageMinutes.get(roomNumber) ?? 190 + index * 13;
  const updatedAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const arrivalDate = status === 'occupied' || status === 'reserved'
    ? new Date(Date.now() + (index % 4) * 86_400_000).toISOString()
    : undefined;
  const guestNameKey = status === 'reserved'
    ? roomNumber === '208' ? 'rooms.guest.confirmedReservation' : 'rooms.guest.reserved'
    : status === 'occupied'
      ? 'rooms.guest.roomNumber'
      : undefined;

  return {
    id: `room-${roomNumber}`,
    number: roomNumber,
    type: vipNumbers.has(roomNumber) ? 'vip' : 'standard',
    status,
    floor,
    view: (['nile', 'garden', 'city'] as const)[index % 3],
    guestNameKey,
    arrivalDate,
    notes: '',
    notesKey: firstPageNotes[roomNumber] ? `rooms.notes.${roomNumber}` : undefined,
    updatedAt,
    log: roomLog(roomNumber, updatedAt),
  };
}

let rooms: Room[] = Array.from({ length: 36 }, (_, index) => {
  const floor = Math.floor(index / 12) + 1;
  const roomIndex = (index % 12) + 1;
  return createRoom(floor * 100 + roomIndex, index);
});

export function listMockRooms(): Room[] {
  return rooms.map((room) => ({ ...room, log: [...room.log] }));
}

export function getMockRoom(id: string): Room | undefined {
  const room = rooms.find((item) => item.id === id);
  return room ? { ...room, log: [...room.log] } : undefined;
}

export function getMockRoomStats(): RoomStats {
  return rooms.reduce<RoomStats>((stats, room) => {
    stats.total += 1;
    if (room.status === 'available') stats.available += 1;
    if (room.status === 'occupied') stats.occupied += 1;
    if (room.status === 'cleaning') stats.cleaning += 1;
    if (room.status === 'maintenance') stats.maintenance += 1;
    if (room.type === 'vip') stats.vip += 1;
    return stats;
  }, { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0, vip: 0 });
}

function createLog(titleKey: string, descriptionKey: string, time: string): RoomLogEntry {
  return { id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`, titleKey, descriptionKey, time };
}

export function updateMockRoom(input: UpdateRoomInput): Room | undefined {
  const room = rooms.find((item) => item.id === input.id);
  if (!room) return undefined;

  const time = new Date().toISOString();
  room.status = input.status;
  room.notes = input.notes;
  room.notesKey = undefined;
  room.updatedAt = time;
  if (input.status === 'available') {
    room.guestName = undefined;
    room.guestNameKey = undefined;
  }
  room.log.unshift(createLog('rooms.log.statusUpdate', 'rooms.log.changesSaved', time));
  return getMockRoom(room.id);
}

export function addMockRoomActivity(input: AddRoomActivityInput): Room | undefined {
  const room = rooms.find((item) => item.id === input.roomId);
  if (!room) return undefined;

  const time = new Date().toISOString();
  room.status = input.status;
  room.notes = input.notes;
  room.notesKey = undefined;
  room.guestName = input.status === 'available' ? undefined : input.guestName.trim() || undefined;
  room.guestNameKey = undefined;
  room.updatedAt = time;
  room.log.unshift(createLog('rooms.log.activityAdded', 'rooms.log.activityAddedDescription', time));
  appendShiftActivity({ id: `shift-${Date.now()}`, roomId: room.id, roomNumber: room.number, status: room.status, guestName: room.guestName, notes: input.notes, time });
  return getMockRoom(room.id);
}

export function resetMockRooms(): void {
  rooms = Array.from({ length: 36 }, (_, index) => {
    const floor = Math.floor(index / 12) + 1;
    const roomIndex = (index % 12) + 1;
    return createRoom(floor * 100 + roomIndex, index);
  });
}
