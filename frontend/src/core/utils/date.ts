export function getDefaultLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement?.lang === 'en') {
    return 'en-EG';
  }
  return 'ar-EG';
}

export const DEFAULT_LOCALE = 'en-GB';

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `8 Oct 2026` — returns `—` for missing/invalid values. */
export function formatDate(value: DateInput, locale: string = getDefaultLocale()): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

/** `8 Oct 2026, 10:15` — returns `—` for missing/invalid values. */
export function formatDateTime(value: DateInput, locale: string = getDefaultLocale()): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** `10:15` — returns `—` for missing/invalid values. */
export function formatTime(value: DateInput, locale: string = getDefaultLocale()): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** ISO `YYYY-MM-DD` day part, safe for `<input type="date">` comparisons. */
export function toDayKey(value: DateInput): string {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}
