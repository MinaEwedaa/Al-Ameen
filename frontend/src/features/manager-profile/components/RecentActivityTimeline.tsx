import React from 'react';
import { Wallet, Sparkles, Wrench, Clock } from 'lucide-react';
import type { ManagerActivityItem } from '../types/manager-profile.types';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './RecentActivityTimeline.css';

interface RecentActivityTimelineProps {
  activities: ManagerActivityItem[];
}

function getActivityIcon(type: ManagerActivityItem['type']) {
  switch (type) {
    case 'payment':
      return Wallet;
    case 'cleaning':
      return Sparkles;
    case 'maintenance':
      return Wrench;
    default:
      return Clock;
  }
}

export function RecentActivityTimeline({
  activities,
}: RecentActivityTimelineProps): React.ReactElement {
  const { t } = useLanguage();

  return (
    <div className="activity-timeline-card">
      <header className="activity-timeline-card__header">
        <h2 className="activity-timeline-card__title">
          {t('manager.profile.activity.title')}
        </h2>
        <p className="activity-timeline-card__subtitle">
          {t('manager.profile.activity.subtitle')}
        </p>
      </header>

      {activities.length === 0 ? (
        <p className="activity-timeline-card__empty">
          {t('manager.profile.activity.empty')}
        </p>
      ) : (
        <ol className="activity-timeline">
          {activities.map((item, index) => {
            const Icon = getActivityIcon(item.type);
            const tone = item.tone || (item.type === 'maintenance' ? 'gold' : 'green');
            const isLast = index === activities.length - 1;

            const itemTitle =
              t(`manager.profile.activity.items.${item.type}.title`) || item.title;
            const itemDesc =
              t(`manager.profile.activity.items.${item.type}.description`) || item.description;

            return (
              <li key={item.id} className="activity-timeline__item">
                <div className="activity-timeline__line-col">
                  <div className={`activity-timeline__icon-circle activity-timeline__icon-circle--${tone}`}>
                    <Icon className="activity-timeline__icon" aria-hidden="true" />
                  </div>
                  {!isLast && <div className="activity-timeline__connector" aria-hidden="true" />}
                </div>

                <div className="activity-timeline__content">
                  <div className="activity-timeline__text">
                    <strong className="activity-timeline__item-title">{itemTitle}</strong>
                    <span className="activity-timeline__item-desc">{itemDesc}</span>
                  </div>
                  <time className="activity-timeline__time">{item.time}</time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
