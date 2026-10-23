import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Bell, LogOut } from 'lucide-react';
import { ROUTES } from '../../../core/constants/routes';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { clearAuthSession } from '../../../core/auth/authManager';
import { logoutRequest } from '../services/manager-profile.api';
import './ProfileBottomBar.css';

interface ProfileBottomBarProps {
  onChangePasswordClick: () => void;
}

export function ProfileBottomBar({
  onChangePasswordClick,
}: ProfileBottomBarProps): React.ReactElement {
  const navigate = useNavigate();
  const { t } = useLanguage();

  function handleNavigateNotifications() {
    navigate(`${ROUTES.managerSettings}?tab=notifications`);
  }

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch {
      // Local logout must proceed even if the network call fails
    }
    clearAuthSession();
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <div className="profile-bottom-bar">
      <div className="profile-bottom-bar__left">
        <button
          type="button"
          className="profile-bottom-bar__btn profile-bottom-bar__btn--secondary"
          onClick={onChangePasswordClick}
        >
          <Settings className="profile-bottom-bar__icon" aria-hidden="true" />
          <span>{t('manager.profile.bottomBar.changePassword')}</span>
        </button>

        <button
          type="button"
          className="profile-bottom-bar__btn profile-bottom-bar__btn--secondary"
          onClick={handleNavigateNotifications}
        >
          <Bell className="profile-bottom-bar__icon" aria-hidden="true" />
          <span>{t('manager.profile.bottomBar.notifications')}</span>
        </button>
      </div>

      <div className="profile-bottom-bar__right">
        <button
          type="button"
          className="profile-bottom-bar__btn profile-bottom-bar__btn--danger"
          onClick={handleLogout}
        >
          <LogOut className="profile-bottom-bar__icon" aria-hidden="true" />
          <span>{t('manager.profile.bottomBar.logout')}</span>
        </button>
      </div>
    </div>
  );
}
