import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ManagerProfile } from '../types/manager-profile.types';
import { ROUTES } from '../../../core/constants/routes';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './ProfileHeaderCard.css';

interface ProfileHeaderCardProps {
  profile: ManagerProfile;
  onEditClick: () => void;
}

export function ProfileHeaderCard({
  profile,
  onEditClick,
}: ProfileHeaderCardProps): React.ReactElement {
  const navigate = useNavigate();
  const { t } = useLanguage();

  function handleNavigateSettings() {
    navigate(`${ROUTES.managerSettings}?tab=notifications`);
  }

  return (
    <div className="profile-header-card">
      <div className="profile-header-card__brand-group">
        <div className="profile-header-card__logo-box">
          <img
            src="/hotel-logo.png"
            alt={t('manager.shell.brand')}
            className="profile-header-card__logo-img"
          />
        </div>

        <div className="profile-header-card__copy">
          <span className="profile-header-card__eyebrow">
            {t('manager.profile.header.eyebrow')}
          </span>
          <h1 className="profile-header-card__title">
            {profile.name === 'حساب المدير' ? t('manager.profile.header.title') : profile.name}
          </h1>
          <p className="profile-header-card__subtitle">
            {t('manager.profile.header.subtitle')}
          </p>
          <span className="profile-header-card__location">
            {t('manager.profile.header.location')}
          </span>
        </div>
      </div>

      <div className="profile-header-card__actions">
        <button
          type="button"
          className="profile-header-card__btn profile-header-card__btn--primary"
          onClick={handleNavigateSettings}
        >
          {t('manager.profile.header.notifications')}
        </button>

        <button
          type="button"
          className="profile-header-card__btn profile-header-card__btn--secondary"
          onClick={onEditClick}
        >
          {t('manager.profile.header.edit')}
        </button>
      </div>
    </div>
  );
}
