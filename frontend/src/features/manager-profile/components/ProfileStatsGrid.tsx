import React from 'react';
import { User, BedDouble, FileText, CheckCircle2 } from 'lucide-react';
import type { ManagerKPIs } from '../types/manager-profile.types';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import './ProfileStatsGrid.css';

interface ProfileStatsGridProps {
  kpis: ManagerKPIs;
}

export function ProfileStatsGrid({ kpis }: ProfileStatsGridProps): React.ReactElement {
  const { language, t } = useLanguage();

  const cards = [
    {
      key: 'employees',
      label: t('manager.profile.stats.employees'),
      value: formatNumber(kpis.activeEmployees, language),
      sublabel: t('manager.profile.stats.employeesHint'),
      icon: User,
      tone: 'green',
    },
    {
      key: 'rooms',
      label: t('manager.profile.stats.rooms'),
      value: formatNumber(kpis.managedRooms, language),
      sublabel: t('manager.profile.stats.roomsHint'),
      icon: BedDouble,
      tone: 'green',
    },
    {
      key: 'reports',
      label: t('manager.profile.stats.reports'),
      value: formatNumber(kpis.generatedReports, language),
      sublabel: t('manager.profile.stats.reportsHint'),
      icon: FileText,
      tone: 'gold',
    },
    {
      key: 'tasks',
      label: t('manager.profile.stats.tasks'),
      value: formatNumber(kpis.managementTasks, language),
      sublabel: t('manager.profile.stats.tasksHint'),
      icon: CheckCircle2,
      tone: 'gold',
    },
  ] as const;

  return (
    <div className="profile-stats-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.key} className={`profile-stat-card profile-stat-card--${card.tone}`}>
            <div className="profile-stat-card__content">
              <span className="profile-stat-card__label">{card.label}</span>
              <strong className="profile-stat-card__value">{card.value}</strong>
              <span className="profile-stat-card__sublabel">{card.sublabel}</span>
            </div>

            <div className="profile-stat-card__icon-wrap" aria-hidden="true">
              <Icon className="profile-stat-card__icon" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
