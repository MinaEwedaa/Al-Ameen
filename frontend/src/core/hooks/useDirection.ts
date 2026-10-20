import { useEffect } from 'react';
import type { Language } from '../i18n';

export function useDirection(language: Language): void {
  useEffect(() => {
    const direction = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [language]);
}
