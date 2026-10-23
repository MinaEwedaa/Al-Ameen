import { ApiError } from '../../../core/api/apiError';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import type { Language } from '../../../core/i18n';
import { KNOWN_API_ERRORS } from '../constants/employees.constants';

/** The feature's own message for the contract's newer error codes, the shared message otherwise */
export function apiErrorText(error: unknown, t: (key: string) => string, language: Language): string {
  if (error instanceof ApiError && (KNOWN_API_ERRORS as readonly string[]).includes(error.code)) {
    return t(`apiErrors.${error.code}`);
  }
  return getErrorMessage(error, language);
}

/** Field named by a 409 CONFLICT / 400 VALIDATION_ERROR (`error.details.field`, or the message as a fallback) */
export function conflictField(error: unknown): 'email' | 'national_id' | null {
  if (!(error instanceof ApiError) || error.code !== 'CONFLICT') return null;
  const text = error.message.toLowerCase();
  if (text.includes('email')) return 'email';
  if (text.includes('national')) return 'national_id';
  return null;
}
