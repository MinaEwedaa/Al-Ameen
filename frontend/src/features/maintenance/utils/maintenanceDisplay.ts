import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import type { MaintenanceRequest } from '../types/maintenance.types';

// Times are always shown in hotel time (Cairo), whatever the device's time zone.
// TODO: remove once utils/format.ts formatClock uses timeZone 'Africa/Cairo', and use formatClock again.
const HOTEL_TIME_ZONE = 'Africa/Cairo';

// A reference is an ID, not a quantity, so it has no thousands separator (MT-1000, not MT-1,000)
export function formatReference(issueId: number | string, language: Language): string {
  if (typeof issueId === 'number' || (typeof issueId === 'string' && /^\d+$/.test(issueId))) {
    const digits = new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG', { useGrouping: false }).format(Number(issueId));
    return `MT-${digits}`;
  }
  const hexSuffix = String(issueId).slice(-6).toUpperCase();
  return `MT-${hexSuffix}`;
}

export function formatRequestTime(isoDate: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    timeZone: HOTEL_TIME_ZONE,
  }).format(new Date(isoDate));
}

/** The API has no "updated at", so the last known change is the resolve time, else the report time */
export function lastUpdateOf(request: MaintenanceRequest): string {
  return request.resolved_date ?? request.created_date;
}

// "منذ ٨ د", "منذ ساعة", ... ; older than a day falls back to the clock time
export function formatTimeAgo(isoDate: string, language: Language, now = new Date()): string {
  const t = (key: string) => getTranslation(language, key);
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(isoDate).getTime()) / 60_000));
  if (minutes < 1) return t('mtAgoNow');
  if (minutes < 60) return t('mtAgoMinutes').replace('{n}', formatNumber(minutes, language));
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return t('mtAgoHour');
  if (hours < 24) return t('mtAgoHours').replace('{n}', formatNumber(hours, language));
  return formatRequestTime(isoDate, language);
}

/** Average minutes from report to resolution, or null when nothing is resolved yet */
export function averageResolutionMinutes(requests: MaintenanceRequest[]): number | null {
  const durations = requests
    .filter((request) => request.status === 'resolved' && request.resolved_date)
    .map((request) => (new Date(request.resolved_date as string).getTime() - new Date(request.created_date).getTime()) / 60_000);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
}

// "Today" means today in Cairo, not on the device
const cairoDay = new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function isToday(isoDate: string, now = new Date()): boolean {
  return cairoDay.format(new Date(isoDate)) === cairoDay.format(now);
}
