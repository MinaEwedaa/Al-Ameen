import { ApiError } from '../../../core/api/apiError';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import type { Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import { ROOM_TYPES_I18N } from '../constants/roomTypes.constants';
import type { RoomType } from '../types/roomType.types';

/** i18n key for a value the server sends as text ("Street view" -> street_view) */
function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Translates known values (amenities, type names) and shows anything else as the server sent it */
function translated(group: string, value: string, t: (key: string) => string): string {
  const key = `${group}.${slug(value)}`;
  const text = t(key);
  return text === key || text === `${ROOM_TYPES_I18N}.${key}` ? value : text;
}

export function amenityLabel(amenity: string, t: (key: string) => string): string {
  return translated('amenityNames', amenity, t);
}

export function typeName(type: RoomType, t: (key: string) => string): string {
  return translated('typeNames', type.name, t);
}

/** The premium category gets the gold card. TODO the contract has no tier field; the name is used for now. */
export function isPremium(type: RoomType): boolean {
  return /vip|suite|premium/i.test(type.name);
}

/** 286000 -> "٢٨٦ ألف ج.م" / "EGP 286K" */
export function formatThousands(value: number, language: Language, t: (key: string) => string): string {
  if (Math.abs(value) < 1000) return t('egpValue').replace('{value}', formatNumber(value, language));
  return t('egpThousands').replace('{value}', formatNumber(value / 1000, language, 1));
}

/** "٧٠٠ — ١٠٠٠" without thousands separators, as in the design */
export function formatPriceRange(min: number, max: number, language: Language): string {
  const format = (value: number) => new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG', { useGrouping: false, maximumFractionDigits: 0 }).format(value);
  return min === max ? format(min) : `${format(min)} — ${format(max)}`;
}

export function apiErrorText(error: unknown, t: (key: string) => string, language: Language): string {
  if (error instanceof ApiError && error.code === 'NAME_ALREADY_EXISTS') return t('apiErrors.NAME_ALREADY_EXISTS');
  return getErrorMessage(error, language);
}
