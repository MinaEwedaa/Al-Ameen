import { useState, useEffect, type ReactNode } from 'react';
import { ThemeContext, type ThemeMode } from './themeContextInstance';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (
      (localStorage.getItem('al-amin-theme') as ThemeMode) ||
      (localStorage.getItem('theme') as ThemeMode) ||
      'light'
    );
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

    if (computedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

    localStorage.setItem('al-amin-theme', themeMode);
    localStorage.setItem('theme', computedTheme);
  }, [themeMode]);

  function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode);
  }

  function toggleTheme() {
    setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, effectiveTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
