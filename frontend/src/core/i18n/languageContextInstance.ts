import { createContext } from 'react';
import type { Language } from './index';

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
