import ar from './locales/ar.json';
import en from './locales/en.json';

export type Language = 'ar' | 'en';

export const translations = { ar, en } as const;
export const defaultLanguage: Language = 'ar';

export function getTranslation(language: Language, key: string): string {
  const dictionary = translations[language];
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, dictionary);

  return typeof value === 'string' ? value : key;
}
