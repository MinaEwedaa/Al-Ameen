import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Bed,
  User,
  Sparkles,
  Wrench,
  Wallet,
  FileText,
  ReceiptText,
  ArrowLeftRight,
  Settings,
  LogOut,
} from 'lucide-react';
import { clearAuthSession } from '../../core/auth/authManager';
import { logoutRequest } from '../../features/auth/services/auth.api';
import { ROUTES } from '../../core/constants/routes';
import { useLanguage } from '../../core/i18n/useLanguage';
import './ManagerSidebar.css';

const sidebarItems = [
  { key: 'dashboard', path: ROUTES.managerDashboard, icon: LayoutGrid },
  { key: 'rooms', path: ROUTES.managerRooms, icon: Bed },
  { key: 'employees', path: ROUTES.managerEmployees, icon: User },
  { key: 'housekeeping', path: ROUTES.managerHousekeeping, icon: Sparkles },
  { key: 'maintenance', path: ROUTES.managerMaintenance, icon: Wrench },
  { key: 'finance', path: ROUTES.managerFinance, icon: Wallet },
  { key: 'reports', path: ROUTES.managerReports, icon: FileText },
  { key: 'refunds', path: ROUTES.managerRefunds, icon: Wallet }, // same icon as finance in the design
  { key: 'passwordRequests', path: ROUTES.managerPasswordRequests, icon: Settings }, // design uses the gear here
  { key: 'shifts', path: ROUTES.managerShifts, icon: ArrowLeftRight },
  { key: 'roomTypes', path: ROUTES.managerRoomTypes, icon: ReceiptText },
  { key: 'profile', path: ROUTES.managerProfile, icon: User },
  { key: 'settings', path: ROUTES.managerSettings, icon: Settings },
] as const;

export function ManagerSidebar(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch {
      // Local logout must proceed even if the server call fails
    }
    clearAuthSession();
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <aside className="manager-sidebar">
      <div className="manager-sidebar__brand">
        <div className="manager-sidebar__logo-tile">
          <img src="/hotel-logo.png" alt={t('manager.shell.brand')} className="manager-sidebar__logo-img" />
          <div className="manager-sidebar__brand-copy">
            <strong className="manager-sidebar__brand-name">{t('manager.shell.brand')}</strong>
            <span className="manager-sidebar__brand-location">{t('manager.shell.location')}</span>
          </div>
        </div>
      </div>

      <p className="manager-sidebar__section-label">{t('manager.shell.section')}</p>

      <nav className="manager-sidebar__nav" aria-label={t('manager.shell.section')}>
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== ROUTES.managerDashboard && location.pathname.startsWith(item.path));

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`manager-sidebar__link ${isActive ? 'manager-sidebar__link--active' : ''}`}
            >
              <Icon className="manager-sidebar__link-icon" aria-hidden="true" />
              <span className="manager-sidebar__link-text">{t(`manager.shell.nav.${item.key}`)}</span>
              {isActive && <span className="manager-sidebar__link-dot" aria-hidden="true" />}
            </NavLink>
          );
        })}
      </nav>

      <div className="manager-sidebar__footer">
        <div className="manager-sidebar__status-card" role="status">
          <div className="manager-sidebar__status-copy">
            <strong className="manager-sidebar__status-title">{t('manager.shell.statusCard.title')}</strong>
            <span className="manager-sidebar__status-subtitle">{t('manager.shell.statusCard.occupancy')}</span>
          </div>
          <span className="manager-sidebar__status-dot" aria-hidden="true" />
        </div>

        <button type="button" className="manager-sidebar__logout" onClick={handleLogout}>
          <LogOut className="manager-sidebar__logout-icon" aria-hidden="true" />
          <span>{t('manager.shell.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
