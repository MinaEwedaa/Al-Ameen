import type { Language } from '../../../core/i18n';

type Translate = (key: string) => string;

/** t() returns the key itself when a translation is missing, so `t(key) || fallback` never falls back */
export function translateOr(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

/** ISO timestamp -> "٠١:١٥ م" / "01:15 PM" in Cairo time */
export function formatActivityTime(iso: string, language: Language): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(date);
}
