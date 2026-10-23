import React from 'react';
import { Check, FileText } from 'lucide-react';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './SettingsHero.css';

interface SettingsHeroProps {
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onExport: () => void;
}

export function SettingsHero({
  hasChanges,
  saving,
  onSave,
  onExport,
}: SettingsHeroProps): React.ReactElement {
  const { t } = useLanguage();

  return (
    <div className="settings-hero">
      <div className="settings-hero__copy">
        <span className="settings-hero__eyebrow">
          {t('manager.settings.hero.eyebrow')}
        </span>
        <h1 className="settings-hero__title">
          {t('manager.settings.hero.title')}
        </h1>
        <p className="settings-hero__subtitle">
          {t('manager.settings.hero.subtitle')}
        </p>
      </div>

      <div className="settings-hero__actions">
        <button
          type="button"
          className="settings-hero__btn settings-hero__btn--gold"
          onClick={onSave}
          disabled={!hasChanges || saving}
        >
          <Check className="settings-hero__btn-icon" aria-hidden="true" />
          <span>
            {saving
              ? t('manager.settings.hero.saving')
              : t('manager.settings.hero.save')}
          </span>
        </button>

        <button
          type="button"
          className="settings-hero__btn settings-hero__btn--export"
          onClick={onExport}
        >
          <FileText className="settings-hero__btn-icon" aria-hidden="true" />
          <span>{t('manager.settings.hero.export')}</span>
        </button>
      </div>
    </div>
  );
}
