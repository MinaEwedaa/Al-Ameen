import type { Language } from '../../../core/i18n';

type Translate = (key: string) => string;

/** t() returns the key itself when a translation is missing, so `t(key) || fallback` never falls back */
export function translateOr(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

/** ISO timestamp -> "٢٣ أكتوبر، ١:٢٠ م" / "Oct 23, 1:20 PM" in Cairo time */
export function formatRequestDate(iso: string, language: Language): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(date);
}
