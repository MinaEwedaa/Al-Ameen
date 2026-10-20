import type { Language } from '../../../core/i18n';
import { getTranslation } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import type { Room, RoomFilters } from '../types/room.types';

function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function filterAndSortRooms(rooms: Room[], filters: RoomFilters, language: Language): Room[] {
  const query = normalizeSearch(filters.q);
  return rooms
    .filter((room) => {
      const translatedGuest = getRoomGuestName(room, language);
      const matchesQuery = !query || normalizeSearch(room.number).includes(query) || normalizeSearch(translatedGuest).includes(query) || normalizeSearch(room.guestName ?? '').includes(query);
      const matchesType = !filters.type || room.type === filters.type;
      const matchesStatus = !filters.status || room.status === filters.status;
      const matchesFloor = filters.floor === '' || room.floor === filters.floor;
      const matchesAvailability = filters.availability === 'all'
        || (filters.availability === 'available' ? room.status === 'available' : room.status !== 'available');
      return matchesQuery && matchesType && matchesStatus && matchesFloor && matchesAvailability;
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function getRoomGuestName(room: Room, language: Language): string {
  if (room.guestNameKey) {
    return getTranslation(language, room.guestNameKey).replace('{number}', formatNumber(Number(room.number), language));
  }
  return room.guestName ?? '—';
}

export function getRoomNotes(room: Room, language: Language): string {
  return room.notesKey ? getTranslation(language, room.notesKey) : room.notes;
}
