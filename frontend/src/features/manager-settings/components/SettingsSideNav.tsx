import React from 'react';
import {
  Building2,
  Clock,
  Bell,
  Globe,
  Palette,
  User,
  UserCircle,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import type { SettingsTabId } from '../types/manager-settings.types';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './SettingsSideNav.css';

interface SettingsSideNavProps {
  activeTab: SettingsTabId;
  onSelectTab: (tab: SettingsTabId) => void;
}

export function SettingsSideNav({
  activeTab,
  onSelectTab,
}: SettingsSideNavProps): React.ReactElement {
  const { t } = useLanguage();

  const navItems = [
    { id: 'account', label: t('manager.settings.nav.account'), icon: User, disabled: true },
    { id: 'profile', label: t('manager.settings.nav.profile'), icon: UserCircle, disabled: true },
    { id: 'language', label: t('manager.settings.nav.language'), icon: Globe, tabId: 'language' as SettingsTabId },
    { id: 'notifications', label: t('manager.settings.nav.notifications'), icon: Bell, tabId: 'notifications' as SettingsTabId },
    { id: 'appearance', label: t('manager.settings.nav.appearance'), icon: Palette, tabId: 'appearance' as SettingsTabId },
    { id: 'hotel', label: t('manager.settings.nav.hotel'), icon: Building2, tabId: 'hotel' as SettingsTabId },
    { id: 'roomConfig', label: t('manager.settings.nav.roomConfig'), icon: Layers, disabled: true },
    { id: 'shifts', label: t('manager.settings.nav.shifts'), icon: Clock, tabId: 'shifts' as SettingsTabId },
    { id: 'systemPreferences', label: t('manager.settings.nav.systemPreferences'), icon: SlidersHorizontal, disabled: true },
  ];

  return (
    <aside className="settings-side-nav" aria-label={t('manager.settings.hero.title')}>
      <nav className="settings-side-nav__list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.tabId && activeTab === item.tabId;

          if (item.disabled) {
            return (
              <div
                key={item.id}
                className="settings-side-nav__item settings-side-nav__item--disabled"
              >
                <Icon className="settings-side-nav__icon" aria-hidden="true" />
                <span className="settings-side-nav__label">{item.label}</span>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`settings-side-nav__item ${
                isActive ? 'settings-side-nav__item--active' : ''
              }`}
              onClick={() => item.tabId && onSelectTab(item.tabId)}
            >
              <Icon className="settings-side-nav__icon" aria-hidden="true" />
              <span className="settings-side-nav__label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
