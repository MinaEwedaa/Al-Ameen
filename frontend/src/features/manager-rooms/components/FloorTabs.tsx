import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import './FloorTabs.css';

export interface FloorTabsProps {
  selectedFloor: number;
  onSelectFloor: (floor: number) => void;
  floors?: number[];
  className?: string;
}

export function FloorTabs({
  selectedFloor,
  onSelectFloor,
  floors = [1, 2, 3],
  className = '',
}: FloorTabsProps) {
  const { language, t } = useLanguage();

  return (
    <div className={`floor-tabs ${className}`.trim()} role="tablist" aria-label="أدوار الفندق">
      {floors.map((floor) => {
        const isActive = floor === selectedFloor;
        const tabLabel =
          floor === 1
            ? t('manager.rooms.floorTabs.floor1')
            : floor === 2
            ? t('manager.rooms.floorTabs.floor2')
            : floor === 3
            ? t('manager.rooms.floorTabs.floor3')
            : `${t('manager.rooms.tile.room')} ${formatNumber(floor, language)}`;

        return (
          <button
            key={floor}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`floor-tab-btn ${isActive ? 'floor-tab-btn--active' : ''}`}
            onClick={() => onSelectFloor(floor)}
          >
            {tabLabel}
          </button>
        );
      })}
    </div>
  );
}
