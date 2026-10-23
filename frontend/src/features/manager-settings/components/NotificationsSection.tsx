import React from 'react';
import type { NotificationSettings } from '../types/manager-settings.types';
import { Switch } from '../../../components/ui/Switch';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './NotificationsSection.css';

interface NotificationsSectionProps {
  notifications: NotificationSettings;
  onChange: (updated: Partial<NotificationSettings>) => void;
}

export function NotificationsSection({
  notifications,
  onChange,
}: NotificationsSectionProps): React.ReactElement {
  const { t } = useLanguage();

  const toggleItems: Array<{
    key: keyof NotificationSettings;
    label: string;
    desc: string;
  }> = [
    {
      key: 'maintenance',
      label: t('manager.settings.notifications.maintenance'),
      desc: t('manager.settings.notifications.subtitleDesc'),
    },
    {
      key: 'cleaning',
      label: t('manager.settings.notifications.cleaning'),
      desc: t('manager.settings.notifications.subtitleDesc'),
    },
    {
      key: 'payments',
      label: t('manager.settings.notifications.payments'),
      desc: t('manager.settings.notifications.subtitleDesc'),
    },
    {
      key: 'pendingTasks',
      label: t('manager.settings.notifications.pendingTasks'),
      desc: t('manager.settings.notifications.subtitleDesc'),
    },
    {
      key: 'shiftHandover',
      label: t('manager.settings.notifications.shiftHandover'),
      desc: t('manager.settings.notifications.subtitleDesc'),
    },
    {
      key: 'reports',
      label: t('manager.settings.notifications.reports'),
      desc: t('manager.settings.notifications.subtitleDesc'),
    },
  ];

  return (
    <section id="settings-notifications" className="settings-card notifications-section">
      <header className="settings-card__header">
        <div className="settings-card__titles">
          <h2 className="settings-card__title">
            {t('manager.settings.notifications.title')}
          </h2>
          <p className="settings-card__subtitle">
            {t('manager.settings.notifications.subtitle')}
          </p>
        </div>
      </header>

      <div className="notifications-section__grid">
        {toggleItems.map((item) => (
          <div key={item.key} className="notification-toggle-card">
            <Switch
              id={`notif-switch-${item.key}`}
              checked={Boolean(notifications[item.key])}
              onChange={(checked) => onChange({ [item.key]: checked })}
              label={item.label}
              description={item.desc}
              className="notification-toggle-card__switch"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
