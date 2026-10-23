import { normalizeDigits } from '../../../utils/digits';
import { AMENITIES_MAX, AMENITY_MAX_LENGTH, CAPACITY_MAX, DESCRIPTION_MAX_LENGTH, PRICE_MAX } from '../constants/roomTypes.constants';

/** "٢٥٠" / "250" / " 250 " -> 250; anything that is not a whole number -> NaN */
export function parseWholeNumber(value: string): number {
  const text = normalizeDigits(value.trim()).replace(/[,٬]/g, '');
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

/** Error key under manager.roomTypes.errors, or null */
export function validatePrice(raw: string): string | null {
  const value = parseWholeNumber(raw);
  if (!raw.trim()) return 'priceRequired';
  if (!Number.isFinite(value)) return 'priceNumber';
  if (value <= 0) return 'pricePositive';
  if (value > PRICE_MAX) return 'priceTooHigh';
  return null;
}

export function validateCapacity(raw: string): string | null {
  const value = parseWholeNumber(raw);
  if (!raw.trim()) return 'capacityRequired';
  if (!Number.isFinite(value) || value < 1 || value > CAPACITY_MAX) return 'capacityRange';
  return null;
}

export function validateDescription(raw: string): string | null {
  return raw.trim().length > DESCRIPTION_MAX_LENGTH ? 'descriptionTooLong' : null;
}

/** Error key for a new amenity, or null when it can be added. `labels` are the visible names already in the list. */
export function validateNewAmenity(value: string, labels: string[]): string | null {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return 'amenityRequired';
  if (text.length > AMENITY_MAX_LENGTH) return 'amenityTooLong';
  if (labels.some((label) => label.toLocaleLowerCase() === text.toLocaleLowerCase())) return 'amenityDuplicate';
  if (labels.length >= AMENITIES_MAX) return 'amenitiesFull';
  return null;
}

export function validateAmenities(amenities: string[]): string | null {
  return amenities.length === 0 ? 'amenitiesEmpty' : null;
}
