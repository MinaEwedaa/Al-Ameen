import { useState, useEffect, type ReactNode } from 'react';
import { ThemeContext, type ThemeMode } from './themeContextInstance';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('al-amin-theme') as ThemeMode) || 'light';
  });

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const computedTheme =
      themeMode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : themeMode;

    setEffectiveTheme(computedTheme);
    document.documentElement.setAttribute('data-theme', computedTheme);
    document.body.setAttribute('data-theme', computedTheme);
    localStorage.setItem('al-amin-theme', themeMode);
  }, [themeMode]);

  function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode);
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
