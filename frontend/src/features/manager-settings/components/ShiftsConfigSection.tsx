import React from 'react';
import { Clock } from 'lucide-react';
import type { ShiftTiming, ShiftId } from '../types/manager-settings.types';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './ShiftsConfigSection.css';

interface ShiftsConfigSectionProps {
  shifts: ShiftTiming[];
  onChange: (updatedShifts: ShiftTiming[]) => void;
}

export function ShiftsConfigSection({
  shifts,
  onChange,
}: ShiftsConfigSectionProps): React.ReactElement {
  const { t } = useLanguage();

  function handleTimeChange(id: ShiftId, field: 'startTime' | 'endTime', value: string) {
    const updated = shifts.map((s) => {
      if (s.id === id) {
        return { ...s, [field]: value };
      }
      return s;
    });
    onChange(updated);
  }

  return (
    <section id="settings-shifts" className="settings-card shifts-config-section">
      <header className="settings-card__header">
        <div className="settings-card__titles">
          <h2 className="settings-card__title">
            {t('manager.settings.shifts.title')}
          </h2>
          <p className="settings-card__subtitle">
            {t('manager.settings.shifts.subtitle')}
          </p>
        </div>
      </header>

      <div className="shifts-config-section__list">
        {shifts.map((shift) => {
          // Night shift can wrap past midnight (e.g. 23:00 to 07:00), but morning/evening should have start < end
          const isInvalid =
            shift.id !== 'night' && shift.startTime && shift.endTime
              ? shift.startTime >= shift.endTime
              : false;

          return (
            <div
              key={shift.id}
              className={`shift-timing-card ${isInvalid ? 'shift-timing-card--error' : ''}`}
            >
              <div className="shift-timing-card__main">
                <div className="shift-timing-card__icon-wrap" aria-hidden="true">
                  <Clock className="shift-timing-card__icon" />
                </div>

                <div className="shift-timing-card__info">
                  <strong className="shift-timing-card__name">
                    {t(`manager.settings.shifts.${shift.id}`) || shift.name}
                  </strong>
                  <span className="shift-timing-card__preview">
                    {shift.startTime} — {shift.endTime}
                  </span>
                </div>
              </div>

              <div className="shift-timing-card__controls">
                <div className="shift-timing-card__input-group">
                  <label
                    htmlFor={`shift-start-${shift.id}`}
                    className="shift-timing-card__time-label"
                  >
                    {t('manager.settings.shifts.startTime')}
                  </label>
                  <input
                    id={`shift-start-${shift.id}`}
                    type="time"
                    className="shift-timing-card__time-input"
                    value={shift.startTime}
                    onChange={(e) => handleTimeChange(shift.id, 'startTime', e.target.value)}
                  />
                </div>

                <span className="shift-timing-card__divider">—</span>

                <div className="shift-timing-card__input-group">
                  <label
                    htmlFor={`shift-end-${shift.id}`}
                    className="shift-timing-card__time-label"
                  >
                    {t('manager.settings.shifts.endTime')}
                  </label>
                  <input
                    id={`shift-end-${shift.id}`}
                    type="time"
                    className="shift-timing-card__time-input"
                    value={shift.endTime}
                    onChange={(e) => handleTimeChange(shift.id, 'endTime', e.target.value)}
                  />
                </div>
              </div>

              {isInvalid && (
                <span className="shift-timing-card__error-text">
                  {t('manager.settings.shifts.validationError')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
