import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { RoomTile } from './RoomTile';
import { EmptyState } from '../../../components/common/EmptyState';
import type { ManagerRoom } from '../types/manager-rooms.types';
import './FloorCard.css';

export interface FloorCardProps {
  floor: number;
  rooms: ManagerRoom[];
  occupancyPercent?: number;
  onSelectRoom?: (room: ManagerRoom) => void;
  className?: string;
}

export function FloorCard({
  floor,
  rooms,
  occupancyPercent,
  onSelectRoom,
  className = '',
}: FloorCardProps) {
  const { language, t } = useLanguage();

  const computedOccupancy =
    occupancyPercent !== undefined
      ? occupancyPercent
      : rooms.length > 0
      ? Math.round(
          (rooms.filter((r) => r.status === 'occupied' || r.status === 'reserved').length /
            rooms.length) *
            100
        )
      : 0;

  const floorTitle = t('manager.rooms.floorCard.title').replace(
    '{floor}',
    formatNumber(floor, language)
  );

  const occupancyText = t('manager.rooms.floorCard.occupancyBadge').replace(
    '{percent}',
    formatNumber(computedOccupancy, language)
  );

  return (
    <div className={`floor-card ${className}`.trim()}>
      <div className="floor-card__header">
        <div className="floor-card__title-group">
          <h2 className="floor-card__title">{floorTitle}</h2>
          <p className="floor-card__subtitle">{t('manager.rooms.floorCard.subtitle')}</p>
        </div>
        <div className="floor-card__occupancy-badge" aria-label={occupancyText}>
          {occupancyText}
        </div>
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          title={t('manager.rooms.emptyTitle')}
          description={t('manager.rooms.emptyDescription')}
        />
      ) : (
        <div className="floor-card__grid">
          {rooms.map((room) => (
            <RoomTile key={room.id} room={room} onClick={onSelectRoom} />
          ))}
        </div>
      )}
    </div>
  );
}
