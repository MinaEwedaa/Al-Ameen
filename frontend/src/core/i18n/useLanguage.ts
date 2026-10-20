import { useContext } from 'react';
import { LanguageContext, type LanguageContextValue } from './languageContextInstance';
import { getTranslation } from './index';

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'ar',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: string) => getTranslation('ar', key),
      dir: 'rtl',
    };
  }
  return context;
}
