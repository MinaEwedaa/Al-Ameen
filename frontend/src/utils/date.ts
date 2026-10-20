import type { Language } from '../core/i18n';
import { getTranslation } from '../core/i18n';
import { formatNumber } from './format';

export function formatRelativeTime(value: string | Date, language: Language, now = Date.now()): string {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  // Missing or invalid dates (e.g. fields the API does not send yet) show a dash instead of a wrong value
  if (!Number.isFinite(timestamp)) return '—';
  const elapsed = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const t = (key: string) => getTranslation(language, `rooms.time.${key}`);

  if (elapsed < minute) return t('now');
  if (elapsed < hour) return t('minutesAgo').replace('{value}', formatNumber(Math.floor(elapsed / minute), language));
  if (elapsed < 2 * hour) return t('hourAgo');
  if (elapsed < 3 * hour) return t('twoHoursAgo');
  if (elapsed < 4 * hour) return t('threeHoursAgo');
  if (elapsed < 24 * hour) return t('hoursAgo').replace('{value}', formatNumber(Math.floor(elapsed / hour), language));
  return t('yesterday');
}

export function formatDate(value: string | Date, language: Language): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
