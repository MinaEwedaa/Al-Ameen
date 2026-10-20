export const DEFAULT_CURRENCY = 'EGP';
export const DEFAULT_LOCALE = 'ar-EG';

export function getDefaultLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement?.lang === 'en') {
    return 'en-EG';
  }
  return 'ar-EG';
}

/**
 * Formats an amount as currency.
 * Currency defaults to EGP for the hotel's Egyptian locale,
 * and locale respects the current document language (en-EG vs ar-EG).
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = getDefaultLocale(),
): string {
  if (!Number.isFinite(amount)) return '—';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
