import type { Language } from '../../../core/i18n';
import { formatNumber, formatPercent } from '../../../utils/format';

const CURRENCY: Record<Language, string> = { ar: 'ج.م', en: 'EGP' };
const THOUSAND: Record<Language, string> = { ar: 'ألف', en: 'K' };

/** `1450` -> `١٬٤٥٠ ج.م` / `EGP 1,450` */
export function formatAmount(amount: number, language: Language): string {
  if (!Number.isFinite(amount)) return '—';
  const value = formatNumber(amount, language);
  return language === 'ar' ? `${value} ${CURRENCY.ar}` : `${CURRENCY.en} ${value}`;
}

/** `24850` -> `٢٤٫٨ ألف` / `24.8K` — the compact scale used on the stat cards */
export function formatCompactAmount(amount: number, language: Language): string {
  if (!Number.isFinite(amount)) return '—';
  if (Math.abs(amount) < 1000) return formatAmount(amount, language);
  const value = formatNumber(amount / 1000, language, 1);
  return language === 'ar' ? `${value} ${THOUSAND.ar}` : `${value}${THOUSAND.en}`;
}

export function formatShare(ratio: number, language: Language): string {
  return formatPercent(Number.isFinite(ratio) ? Math.round(ratio * 100) : 0, language);
}

/** Cairo time `10:15 ص` / `10:15 AM` */
export function formatPaymentTime(value: string | undefined, language: Language): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(date);
}

/** Cairo date `9 أكتوبر 2026` / `9 Oct 2026` */
export function formatPaymentDate(value: string | undefined, language: Language): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Cairo',
  }).format(date);
}
