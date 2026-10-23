import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { AppearanceMode } from '../types/manager-settings.types';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useTheme } from '../../../core/theme/useTheme';
import './PreferencesSection.css';

interface PreferencesSectionProps {
  appearance: AppearanceMode;
  onAppearanceChange: (mode: AppearanceMode) => void;
}

export function PreferencesSection({
  appearance,
  onAppearanceChange,
}: PreferencesSectionProps): React.ReactElement {
  const { language, setLanguage, t } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();

  const currentAppearance = appearance || themeMode;

  function handleSelectAppearance(mode: AppearanceMode) {
    onAppearanceChange(mode);
    setThemeMode(mode);
  }

  return (
    <div className="settings-card preferences-section">
      <div id="settings-appearance" className="preferences-section__group">
        <span className="preferences-section__label">
          {t('manager.settings.preferences.appearance')}
        </span>

        <div
          className="segmented-pill-group"
          role="radiogroup"
          aria-label={t('manager.settings.preferences.appearance')}
        >
          <button
            type="button"
            role="radio"
            aria-checked={currentAppearance === 'light'}
            className={`segmented-pill-btn ${currentAppearance === 'light' ? 'segmented-pill-btn--active' : ''}`}
            onClick={() => handleSelectAppearance('light')}
          >
            <Sun size={14} aria-hidden="true" />
            <span>{t('manager.settings.preferences.light')}</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={currentAppearance === 'dark'}
            className={`segmented-pill-btn ${currentAppearance === 'dark' ? 'segmented-pill-btn--active' : ''}`}
            onClick={() => handleSelectAppearance('dark')}
          >
            <Moon size={14} aria-hidden="true" />
            <span>{t('manager.settings.preferences.dark')}</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={currentAppearance === 'system'}
            className={`segmented-pill-btn ${currentAppearance === 'system' ? 'segmented-pill-btn--active' : ''}`}
            onClick={() => handleSelectAppearance('system')}
          >
            <Monitor size={14} aria-hidden="true" />
            <span>{t('manager.settings.preferences.system')}</span>
          </button>
        </div>
      </div>

      <div id="settings-language" className="preferences-section__group">
        <span className="preferences-section__label">
          {t('manager.settings.preferences.language')}
        </span>

        <div className="segmented-pill-group" role="radiogroup" aria-label={t('manager.settings.preferences.language')}>
          <button
            type="button"
            role="radio"
            aria-checked={language === 'ar'}
            className={`segmented-pill-btn ${language === 'ar' ? 'segmented-pill-btn--active' : ''}`}
            onClick={() => setLanguage('ar')}
          >
            {t('manager.settings.preferences.arabic')}
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={language === 'en'}
            className={`segmented-pill-btn ${language === 'en' ? 'segmented-pill-btn--active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            {t('manager.settings.preferences.english')}
          </button>
        </div>
      </div>
    </div>
  );
}
