import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { Card } from '../../../components/ui/Card';
import { StackedStatusBar, type StatusBarSegment } from '../../../components/ui/StackedStatusBar';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import type { RoomsOverview } from '../types/manager-dashboard.types';
import './RoomsOverviewCard.css';

export interface RoomsOverviewCardProps {
  data: RoomsOverview;
  className?: string;
}

export function RoomsOverviewCard({ data, className = '' }: RoomsOverviewCardProps) {
  const { language, t } = useLanguage();

  const segments: StatusBarSegment[] = [
    {
      key: 'occupied',
      label: t('manager.dashboard.roomsOverviewCard.occupied'),
      value: data.statusCounts.occupied,
      tone: 'primary',
    },
    {
      key: 'available',
      label: t('manager.dashboard.roomsOverviewCard.available'),
      value: data.statusCounts.available,
      tone: 'teal',
    },
    {
      key: 'reserved',
      label: t('manager.dashboard.roomsOverviewCard.reserved'),
      value: data.statusCounts.reserved,
      tone: 'purple',
    },
    {
      key: 'cleaning',
      label: t('manager.dashboard.roomsOverviewCard.cleaning'),
      value: data.statusCounts.cleaning,
      tone: 'amber',
    },
    {
      key: 'maintenance',
      label: t('manager.dashboard.roomsOverviewCard.maintenance'),
      value: data.statusCounts.maintenance,
      tone: 'danger',
    },
  ];

  return (
    <Card className={`rooms-overview-card ${className}`.trim()}>
      <header className="rooms-overview-card__header">
        <div className="rooms-overview-card__title-group">
          <h3 className="rooms-overview-card__title">
            {t('manager.dashboard.roomsOverviewCard.title')}
          </h3>
          <p className="rooms-overview-card__subtitle">
            {t('manager.dashboard.roomsOverviewCard.subtitle')}
          </p>
        </div>
        <span className="rooms-overview-card__badge">
          {t('manager.dashboard.roomsOverviewCard.badge')}
        </span>
      </header>

      {/* 3 mini stat tiles: standard, VIP, occupancy % */}
      <div className="rooms-overview-card__tiles">
        <div className="rooms-overview-card__tile">
          <span className="rooms-overview-card__tile-value">
            {formatNumber(data.standardCount, language)}
          </span>
          <span className="rooms-overview-card__tile-label">
            {t('manager.dashboard.roomsOverviewCard.standard')}
          </span>
        </div>
        <div className="rooms-overview-card__tile">
          <span className="rooms-overview-card__tile-value">
            {formatNumber(data.vipCount, language)}
          </span>
          <span className="rooms-overview-card__tile-label">
            {t('manager.dashboard.roomsOverviewCard.vip')}
          </span>
        </div>
        <div className="rooms-overview-card__tile">
          <span className="rooms-overview-card__tile-value rooms-overview-card__tile-value--accent">
            {formatNumber(data.occupancyPercent, language)}%
          </span>
          <span className="rooms-overview-card__tile-label">
            {t('manager.dashboard.roomsOverviewCard.occupancy')}
          </span>
        </div>
      </div>

      {/* Stacked Status Bar with legend */}
      <StackedStatusBar
        segments={segments}
        total={data.total}
        ariaLabel={t('manager.dashboard.roomsOverviewCard.title')}
      />

      {/* Per-floor progress rows */}
      <div className="rooms-overview-card__floors">
        {data.perFloorOccupancy.map((floor) => {
          const floorLabel =
            floor.floorNumber === 1
              ? t('manager.dashboard.roomsOverviewCard.floor1')
              : floor.floorNumber === 2
              ? t('manager.dashboard.roomsOverviewCard.floor2')
              : floor.floorNumber === 3
              ? t('manager.dashboard.roomsOverviewCard.floor3')
              : floor.label;

          return (
            <ProgressBar
              key={floor.floorNumber}
              value={floor.occupancyPercent}
              label={floorLabel}
              valueText={`${formatNumber(floor.occupancyPercent, language)}%`}
              layout="inline"
              tone="success"
              size="sm"
            />
          );
        })}
      </div>
    </Card>
  );
}
