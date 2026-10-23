import { Wallet, Sparkles, Wrench, Bed } from 'lucide-react';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { Card } from '../../../components/ui/Card';
import { Timeline, type TimelineItem } from '../../../components/common/Timeline';
import type { RecentActivityItem } from '../types/manager-dashboard.types';
import './LatestActivitiesCard.css';
import { formatRelative } from '../utils/dashboardLabels';

export interface LatestActivitiesCardProps {
  activities: RecentActivityItem[];
  className?: string;
}

function renderActivityIcon(type: RecentActivityItem['type']) {
  switch (type) {
    case 'payment':
      return <Wallet size={16} aria-hidden="true" />;
    case 'cleaning':
      return <Sparkles size={16} aria-hidden="true" />;
    case 'maintenance':
      return <Wrench size={16} aria-hidden="true" />;
    case 'checkin':
    default:
      return <Bed size={16} aria-hidden="true" />;
  }
}

export function LatestActivitiesCard({ activities, className = '' }: LatestActivitiesCardProps) {
  const { language, t } = useLanguage();

  const activityMap = new Map<string, RecentActivityItem>(
    activities.map((act) => [act.id, act]),
  );

  const timelineItems: TimelineItem[] = activities.map((act) => ({
    id: act.id,
    title: act.title,
    description: act.description,
    time: (act.timestamp && formatRelative(act.timestamp, language)) || act.time,
  }));

  return (
    <Card className={`latest-activities-card ${className}`.trim()}>
      <header className="latest-activities-card__header">
        <h3 className="latest-activities-card__title">
          {t('manager.dashboard.latestActivitiesCard.title')}
        </h3>
        <p className="latest-activities-card__subtitle">
          {t('manager.dashboard.latestActivitiesCard.subtitle')}
        </p>
      </header>

      <div className="latest-activities-card__timeline-wrapper">
        <Timeline
          items={timelineItems}
          markerTone="primary"
          renderItem={(item) => {
            const raw = activityMap.get(item.id);
            const tone = raw?.tone ?? 'primary';
            const type = raw?.type ?? 'checkin';

            return (
              <div className="latest-activities-card__content-row">
                <div
                  className={`latest-activities-card__icon-box latest-activities-card__icon-box--${tone}`}
                >
                  {renderActivityIcon(type)}
                </div>
                <div className="latest-activities-card__text-group">
                  <span className="latest-activities-card__item-title">{item.title}</span>
                  {item.description && (
                    <p className="latest-activities-card__item-desc">{item.description}</p>
                  )}
                </div>
              </div>
            );
          }}
        />
      </div>
    </Card>
  );
}
