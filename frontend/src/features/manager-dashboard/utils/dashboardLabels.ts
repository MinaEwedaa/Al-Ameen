import type { Language } from '../../../core/i18n';

type Translate = (key: string) => string;

/** t() returns the key itself when a translation is missing */
export function translateOr(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

/** ISO time -> "7:00 AM" / "٠٧:٠٠ ص" in Cairo time */
export function formatCairoClock(iso: string, language: Language): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Cairo',
  }).format(date);
}

/** "5 hours ago" / "منذ ٥ ساعات" using the browser's Intl rules for each language */
export function formatRelative(iso: string, language: Language): string | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const format = new Intl.RelativeTimeFormat(language === 'ar' ? 'ar-EG' : 'en', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}
