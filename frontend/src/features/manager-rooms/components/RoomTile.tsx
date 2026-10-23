import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import type { ManagerRoom } from '../types/manager-rooms.types';
import './RoomTile.css';

export interface RoomTileProps {
  room: ManagerRoom;
  onClick?: (room: ManagerRoom) => void;
  className?: string;
}

export function RoomTile({ room, onClick, className = '' }: RoomTileProps) {
  const { language, t } = useLanguage();

  const isVip = room.type === 'vip';
  const typeLabel = isVip
    ? t('manager.rooms.tile.vip')
    : t('manager.rooms.tile.standard');

  const statusKey = `manager.rooms.tile.status.${room.status}`;
  const statusLabel = t(statusKey);

  const guestText =
    room.guestName ||
    (room.status === 'occupied'
      ? t('manager.rooms.tile.currentGuest')
      : t('manager.rooms.tile.noGuest'));

  const priceText = `${formatNumber(room.price, language)} ${t('manager.rooms.tile.egp')}`;

  const containerClasses = [
    'room-tile',
    isVip ? 'room-tile--vip' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={containerClasses}
      onClick={() => onClick?.(room)}
      aria-label={`${t('manager.rooms.tile.room')} ${room.number} - ${typeLabel} - ${statusLabel}`}
    >
      <div className="room-tile__header">
        <span className="room-tile__number">{formatNumber(Number(room.number), language)}</span>
        <span className="room-tile__label">{t('manager.rooms.tile.room')}</span>
      </div>

      <div className="room-tile__status-row">
        <span className={`room-tile__status-badge room-tile__status-badge--${room.status}`}>
          {statusLabel}
        </span>
      </div>

      <div className="room-tile__info-row">
        <span className="room-tile__type">{typeLabel}</span>
        <span className="room-tile__price">{priceText}</span>
      </div>

      <div className="room-tile__footer">
        <span className="room-tile__guest">{guestText}</span>
      </div>
    </button>
  );
}
