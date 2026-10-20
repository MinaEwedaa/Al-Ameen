import { AppError } from './AppError';
import { defaultLanguage, getTranslation, type Language } from '../i18n';

// بترجّع رسالة بالعربي (أو الإنجليزي) حسب error.code، ومبتعرضش error.message أبدًا
export function getErrorMessage(
  error: unknown,
  language: Language = defaultLanguage,
): string {
  const code = error instanceof AppError ? error.code : 'UNKNOWN_ERROR';
  const key = `errors.${code}`;
  const message = getTranslation(language, key);

  return message === key
    ? getTranslation(language, 'errors.UNKNOWN_ERROR')
    : message;
}