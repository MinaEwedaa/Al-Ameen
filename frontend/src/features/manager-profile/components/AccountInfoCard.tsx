import React from 'react';
import type { ManagerProfile } from '../types/manager-profile.types';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './AccountInfoCard.css';

interface AccountInfoCardProps {
  profile: ManagerProfile;
}

export function AccountInfoCard({ profile }: AccountInfoCardProps): React.ReactElement {
  const { t } = useLanguage();

  return (
    <div className="account-info-card">
      <header className="account-info-card__header">
        <h2 className="account-info-card__title">
          {t('manager.profile.account.title')}
        </h2>
        <p className="account-info-card__subtitle">
          {t('manager.profile.account.subtitle')}
        </p>
      </header>

      <div className="account-info-card__grid">
        <div className="account-info-tile">
          <span className="account-info-tile__label">
            {t('manager.profile.account.role')}
          </span>
          <strong className="account-info-tile__value">
            {profile.role === 'مدير الفندق'
              ? t('manager.profile.account.roleValue')
              : (profile.role || t('manager.profile.account.roleValue'))}
          </strong>
        </div>

        <div className="account-info-tile">
          <span className="account-info-tile__label">
            {t('manager.profile.account.accountName')}
          </span>
          <strong className="account-info-tile__value">
            {profile.name === 'حساب المدير' || profile.accountName === 'حساب المدير'
              ? t('manager.profile.account.accountNameValue')
              : (profile.name || profile.accountName || t('manager.profile.account.accountNameValue'))}
          </strong>
        </div>

        <div className="account-info-tile">
          <span className="account-info-tile__label">
            {t('manager.profile.account.email')}
          </span>
          <strong className="account-info-tile__value account-info-tile__value--ltr">
            <bdi>{profile.email}</bdi>
          </strong>
        </div>

        <div className="account-info-tile">
          <span className="account-info-tile__label">
            {t('manager.profile.account.phone')}
          </span>
          <strong className="account-info-tile__value account-info-tile__value--ltr">
            <bdi>{profile.phone}</bdi>
          </strong>
        </div>

        <div className="account-info-tile">
          <span className="account-info-tile__label">
            {t('manager.profile.account.lastLogin')}
          </span>
          <strong className="account-info-tile__value">
            {profile.lastLogin === 'اليوم، 08:12 ص'
              ? t('manager.profile.account.lastLoginValue')
              : (profile.lastLogin || t('manager.profile.account.lastLoginValue'))}
          </strong>
        </div>

        <div className="account-info-tile">
          <span className="account-info-tile__label">
            {t('manager.profile.account.status')}
          </span>
          <div className="account-info-tile__status-wrap">
            <span
              className={`account-status-badge account-status-badge--${profile.status}`}
            >
              <span className="account-status-badge__dot" aria-hidden="true" />
              <span>
                {profile.status === 'active'
                  ? t('manager.profile.account.statusActive')
                  : t('manager.profile.account.statusInactive')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
