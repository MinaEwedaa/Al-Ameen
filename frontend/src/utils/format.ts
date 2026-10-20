import type { Language } from '../core/i18n';

function localeFor(language: Language): string {
  return language === 'ar' ? 'ar-EG' : 'en-EG';
}

export function formatNumber(value: number, language: Language, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(localeFor(language), { maximumFractionDigits }).format(value);
}

export function formatCurrency(value: number, language: Language): string {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value);
}

/** `68` -> `٦٨٪` / `68%` (Arabic uses the Arabic percent sign, as in the prototype) */
export function formatPercent(value: number, language: Language): string {
  return `${formatNumber(value, language, 1)}${language === 'ar' ? '٪' : '%'}`;
}

export function formatClock(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  }).format(date);
}

export function formatLongDate(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}