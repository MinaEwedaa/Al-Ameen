import React from 'react';
import { Download, SlidersHorizontal, Check } from 'lucide-react';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './PasswordRequestsHero.css';

interface PasswordRequestsHeroProps {
  onExport: () => void;
  pendingOnly: boolean;
  onTogglePendingOnly: () => void;
  pendingCount: number;
}

export function PasswordRequestsHero({
  onExport,
  pendingOnly,
  onTogglePendingOnly,
  pendingCount,
}: PasswordRequestsHeroProps): React.ReactElement {
  const { t } = useLanguage();

  return (
    <section className="pw-hero">
      <div className="pw-hero__decor pw-hero__decor--1" aria-hidden="true" />
      <div className="pw-hero__decor pw-hero__decor--2" aria-hidden="true" />

      <div className="pw-hero__content">
        <span className="pw-hero__eyebrow">{t('manager.passwordRequests.hero.eyebrow')}</span>
        <h1 className="pw-hero__title">{t('manager.passwordRequests.hero.title')}</h1>
        <p className="pw-hero__subtitle">{t('manager.passwordRequests.hero.subtitle')}</p>
      </div>

      <div className="pw-hero__actions">
        <button
          type="button"
          className={`pw-hero__btn pw-hero__btn--filter ${
            pendingOnly ? 'pw-hero__btn--filter-active' : ''
          }`}
          onClick={onTogglePendingOnly}
        >
          {pendingOnly ? (
            <Check className="pw-hero__btn-icon" aria-hidden="true" />
          ) : (
            <SlidersHorizontal className="pw-hero__btn-icon" aria-hidden="true" />
          )}
          <span>{t('manager.passwordRequests.hero.pendingFilter')}</span>
          {pendingCount > 0 && <span className="pw-hero__badge">{pendingCount}</span>}
        </button>

        <button
          type="button"
          className="pw-hero__btn pw-hero__btn--export"
          onClick={onExport}
        >
          <Download className="pw-hero__btn-icon" aria-hidden="true" />
          <span>{t('manager.passwordRequests.hero.export')}</span>
        </button>
      </div>
    </section>
  );
}
