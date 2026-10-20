/** Helpers for rendering Arabic-Indic numerals in the UI (display-only; no logic impact). */

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/** Converts Western digits to Arabic-Indic and the decimal mark to `٫`. */
export function toArabicDigits(value: string | number): string {
  return String(value)
    .replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)])
    .replace(/\./g, '٫');
}

/** `1450` → `١٬٤٥٠ ج.م` — Arabic-Indic money formatting used across the redesigned pages. */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '—';

  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
  return `${toArabicDigits(formatted)} ج.م`;
}

/** `42800` → `٤٢٫٨ ألف` — compact scale used in the Figma stat cards. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';

  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${toArabicDigits((value / 1_000_000).toFixed(1))} مليون`;
  if (abs >= 1_000) return `${toArabicDigits((value / 1_000).toFixed(1))} ألف`;
  return toArabicDigits(Math.round(value));
}

/** Compact EGP amounts for payment summaries. */
export function formatCompactMoney(amount: number): string {
  const formatted = formatCompact(amount);
  return formatted === '—' ? formatted : `${formatted} ج.م`;
}

/** `0.83` → `٨٣٪` — percentage labels. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${toArabicDigits(Math.round(ratio * 100))}٪`;
}
