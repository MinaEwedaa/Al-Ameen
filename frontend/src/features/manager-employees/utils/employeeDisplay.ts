import { getTranslation, type Language } from '../../../core/i18n';
import { toArabicDigits } from '../../../core/utils/numerals';
import { normalizeDigits } from '../../../utils/digits';
import { EMPLOYEES_I18N } from '../constants/employees.constants';
import type { EmployeeStatus, Staff } from '../types/employee.types';

function localeFor(language: Language): string {
  return language === 'ar' ? 'ar-EG' : 'en-EG';
}

/** Today's business date in Africa/Cairo (YYYY-MM-DD), as the contract uses for shifts */
export function cairoBusinessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** First letter of the name, for the avatar square */
export function avatarLetter(name: string): string {
  return Array.from(name.trim())[0] ?? '?';
}

/** What the status column shows: presence when checked in, otherwise off shift; deactivated accounts first */
export function employeeStatus(member: Staff): EmployeeStatus {
  if (!member.is_active) return 'INACTIVE';
  const presence = member.today_shift?.presence;
  return presence ?? 'OFF_SHIFT';
}

export function isWorkingNow(member: Staff): boolean {
  const status = employeeStatus(member);
  return status === 'ON_DUTY' || status === 'AVAILABLE' || status === 'ON_BREAK';
}

/** +201001234567 -> +20 100 123 4567 (Arabic-Indic digits in Arabic). Wrap it in dir="ltr". */
export function formatPhone(phone: string, language: Language): string {
  const match = /^\+20(\d{3})(\d{3})(\d{4})$/.exec(phone);
  const groups = match ? ['+20', match[1], match[2], match[3]] : [phone];
  // Arabic-Indic digit groups would be reordered right-to-left by the browser, so each space is pinned with a left-to-right mark
  return groups.map((group) => (language === 'ar' ? toArabicDigits(group) : group)).join('‎ ‎');
}

/** The masked national ID (******4567) with Arabic-Indic digits in Arabic */
export function formatMaskedId(value: string | null, language: Language): string {
  if (!value) return '—';
  return language === 'ar' ? toArabicDigits(value) : value;
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

/** "2026-11-01" -> "١ نوفمبر ٢٠٢٦" */
export function formatDay(value: string, language: Language): string {
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeFor(language), { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** "اليوم، ٠٨:١٢ ص" / "أمس، ..." / a date, or "لم يسجّل الدخول بعد" */
export function formatLastLogin(value: string | null, language: Language, now = new Date()): string {
  const t = (key: string) => getTranslation(language, `${EMPLOYEES_I18N}.${key}`);
  if (!value) return t('neverLoggedIn');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const time = formatClock(value, language);
  const separator = language === 'ar' ? '،' : ',';
  const today = cairoBusinessDate(now);
  const day = cairoBusinessDate(date);
  if (day === today) return `${t('today')}${separator} ${time}`;
  if (day === cairoBusinessDate(new Date(now.getTime() - 86_400_000))) return `${t('yesterday')}${separator} ${time}`;
  const label = new Intl.DateTimeFormat(localeFor(language), { day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' }).format(date);
  return `${label}${separator} ${time}`;
}

/** Lower-cases and folds Arabic letter variants (أ/إ/آ -> ا, ة -> ه, ى -> ي) and digits, for search */
export function normalizeSearch(value: string): string {
  return normalizeDigits(value.trim())
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '');
}

/**
 * Picks the plural form of `${key}.${form}` (Arabic has zero/one/two/few/many/other) and fills {count}.
 * Falls back to `${key}.other` when a form is missing.
 */
export function pluralText(t: (key: string) => string, key: string, count: number, language: Language): string {
  const form = new Intl.PluralRules(language).select(count);
  const exact = `${key}.${form}`;
  const text = t(exact);
  const template = text === `${EMPLOYEES_I18N}.${exact}` || text === exact ? t(`${key}.other`) : text;
  return template.replace('{count}', new Intl.NumberFormat(localeFor(language)).format(count));
}
