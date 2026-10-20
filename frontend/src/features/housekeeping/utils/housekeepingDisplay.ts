import type { Language } from '../../../core/i18n';

// Times are always shown in hotel time (Cairo), whatever the device's time zone.
// TODO: remove once utils/format.ts formatClock uses timeZone 'Africa/Cairo', and use formatClock again.
const HOTEL_TIME_ZONE = 'Africa/Cairo';

// TEMP: the floor is the first digit of the room number until the backend sends it
export function getFloor(roomId: number | string): string {
  return String(roomId).charAt(0);
}

export function formatTaskTime(isoDate: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    timeZone: HOTEL_TIME_ZONE,
  }).format(new Date(isoDate));
}

// "Today" means today in Cairo, not on the device
const cairoDay = new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function isToday(isoDate: string, now = new Date()): boolean {
  return cairoDay.format(new Date(isoDate)) === cairoDay.format(now);
}
