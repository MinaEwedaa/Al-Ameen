import { ApiError } from '../../../core/api/apiError';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import type { Language } from '../../../core/i18n';
import { formatCurrency } from '../../../utils/format';
import { KNOWN_API_ERRORS, SHIFTS_I18N } from '../constants/shifts.constants';
import type { ShiftOverview, ShiftReportDetail } from '../types/shift.types';

function localeFor(language: Language): string {
  return language === 'ar' ? 'ar-EG' : 'en-EG';
}

/**
 * Report money tiles in drawer-count order (v1.2 §9): gross, the three collection methods, refunds,
 * retained cancellation amounts, net. Fields the server leaves out are skipped.
 */
export function reportMoneyRows(report: ShiftReportDetail, t: (key: string) => string, language: Language) {
  const rows: Array<[string, number | undefined]> = [
    ['tiles.gross', report.gross_revenue],
    ['tiles.cash', report.cash_total],
    ['tiles.instapay', report.instapay_total],
    ['tiles.vodafoneCash', report.vodafone_cash_total],
    ['tiles.refunds', report.refunds_total],
    ['tiles.retained', report.cancellation_retained_total],
    ['tiles.net', report.net_revenue],
  ];
  return rows
    .filter((row): row is [string, number] => typeof row[1] === 'number')
    .map(([key, value]) => ({ label: t(key), value: formatCurrency(value, language) }));
}

/** Today's business date in Africa/Cairo (YYYY-MM-DD) */
export function cairoBusinessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** ISO time -> "٠٧:٠٠ ص" / "07:00 AM" in Cairo time */
export function formatClock(iso: string, language: Language): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeFor(language), { hour: '2-digit', minute: '2-digit', hourCycle: 'h12', timeZone: 'Africa/Cairo' }).format(date);
}

export function formatShiftRange(startIso: string, endIso: string, language: Language): string {
  return `${formatClock(startIso, language)} — ${formatClock(endIso, language)}`;
}

export function formatDateTime(value: string, language: Language): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h12', timeZone: 'Africa/Cairo',
  }).format(date);
}

/** "2026-10-22" -> "٢٢ أكتوبر ٢٠٢٦" */
export function formatDay(value: string, language: Language): string {
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeFor(language), { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/**
 * The "حالة التسليم" row of a card: the report's review status once submitted,
 * otherwise it follows the shift (running = being prepared, not started = waiting).
 */
export function handoverKey(shift: ShiftOverview): string {
  if (shift.report) return `review.${shift.report.review_status}`;
  if (shift.status === 'ACTIVE') return 'handover.PREPARING';
  if (shift.status === 'SCHEDULED') return 'handover.WAITING';
  if (shift.status === 'COMPLETED') return 'handover.NOT_SUBMITTED';
  return 'handover.CANCELLED';
}

/**
 * Picks the plural form of `${key}.${form}` (Arabic has zero/one/two/few/many/other) and fills {count}.
 * Falls back to `${key}.other` when a form is missing.
 */
export function pluralText(t: (key: string) => string, key: string, count: number, language: Language): string {
  const form = new Intl.PluralRules(language).select(count);
  const exact = `${key}.${form}`;
  const text = t(exact);
  const template = text === `${SHIFTS_I18N}.${exact}` || text === exact ? t(`${key}.other`) : text;
  return template.replace('{count}', new Intl.NumberFormat(localeFor(language)).format(count));
}

/** The feature's own message for the contract's newer error codes, the shared message otherwise */
export function apiErrorText(error: unknown, t: (key: string) => string, language: Language): string {
  if (error instanceof ApiError && (KNOWN_API_ERRORS as readonly string[]).includes(error.code)) {
    return t(`apiErrors.${error.code}`);
  }
  return getErrorMessage(error, language);
}
