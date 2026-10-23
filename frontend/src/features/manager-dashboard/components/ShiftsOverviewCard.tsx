import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { Card } from '../../../components/ui/Card';
import type { ShiftOverviewItem } from '../types/manager-dashboard.types';
import './ShiftsOverviewCard.css';
import { formatCairoClock, translateOr } from '../utils/dashboardLabels';

export interface ShiftsOverviewCardProps {
  shifts: ShiftOverviewItem[];
  className?: string;
  onViewDetails?: () => void;
  onSelectShift?: (shift: ShiftOverviewItem) => void;
}

export function ShiftsOverviewCard({
  shifts,
  className = '',
  onViewDetails,
  onSelectShift,
}: ShiftsOverviewCardProps) {
  const { language, dir, t } = useLanguage();

  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <Card className={`shifts-overview-card ${className}`.trim()}>
      <header className="shifts-overview-card__header">
        <div className="shifts-overview-card__title-group">
          <h3 className="shifts-overview-card__title">
            {t('manager.dashboard.shiftsOverviewCard.title')}
          </h3>
          <p className="shifts-overview-card__subtitle">
            {t('manager.dashboard.shiftsOverviewCard.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="shifts-overview-card__details-link"
          onClick={onViewDetails}
        >
          <span>{t('manager.dashboard.shiftsOverviewCard.viewDetails')}</span>
          <Chevron size={16} aria-hidden="true" />
        </button>
      </header>

      <ul className="shifts-overview-card__list">
        {shifts.map((shift) => {
          const statusKey = `manager.dashboard.shiftsOverviewCard.status.${shift.status}`;
          const statusLabel = t(statusKey) || shift.statusLabel;
          const isActive = shift.status === 'active';

          return (
            <li
              key={shift.id}
              className="shifts-overview-card__item"
              onClick={() => onSelectShift?.(shift)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectShift?.(shift);
                }
              }}
            >
              {/* Shift info: icon + name + time range + staff */}
              <div className="shifts-overview-card__shift-info">
                <div
                  className={`shifts-overview-card__icon-circle ${
                    isActive
                      ? 'shifts-overview-card__icon-circle--active'
                      : 'shifts-overview-card__icon-circle--upcoming'
                  }`}
                >
                  <Clock size={18} aria-hidden="true" />
                </div>
                <div className="shifts-overview-card__shift-meta">
                  <span className="shifts-overview-card__shift-name">
                    {shift.shiftType
                      ? translateOr(t, `manager.dashboard.shiftNames.${shift.shiftType}`, shift.name)
                      : shift.name}
                  </span>
                  <span className="shifts-overview-card__shift-sub">
                    {shift.startIso && shift.endIso
                      ? `${formatCairoClock(shift.startIso, language)} - ${formatCairoClock(shift.endIso, language)}`
                      : shift.timeRange}{' '}
                    · <bdi>{shift.staffName}</bdi>
                  </span>
                </div>
              </div>

              {/* Rooms count metric */}
              <div className="shifts-overview-card__metric">
                <span className="shifts-overview-card__metric-label">
                  {t('manager.dashboard.shiftsOverviewCard.roomsLabel')}
                </span>
                <span className="shifts-overview-card__metric-value">
                  {formatNumber(shift.roomsCount, language)}{' '}
                  {t('manager.dashboard.shiftsOverviewCard.roomsSuffix')}
                </span>
              </div>

              {/* Revenue metric */}
              <div className="shifts-overview-card__metric">
                <span className="shifts-overview-card__metric-label">
                  {t('manager.dashboard.shiftsOverviewCard.revenueLabel')}
                </span>
                <span className="shifts-overview-card__metric-value">
                  {formatNumber(shift.revenue, language)}{' '}
                  {t('manager.dashboard.shiftsOverviewCard.egpSuffix')}
                </span>
              </div>

              {/* Status badge */}
              <span
                className={`shifts-overview-card__status-badge shifts-overview-card__status-badge--${shift.status}`}
              >
                {statusLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
