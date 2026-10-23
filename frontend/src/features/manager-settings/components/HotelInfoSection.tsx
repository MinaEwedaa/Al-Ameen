import React from 'react';
import type { HotelInfoSettings } from '../types/manager-settings.types';
import { useLanguage } from '../../../core/i18n/useLanguage';
import './HotelInfoSection.css';

interface HotelInfoSectionProps {
  hotelInfo: HotelInfoSettings;
  onChange: (updated: Partial<HotelInfoSettings>) => void;
  showAutoSavedBadge?: boolean;
}

export function HotelInfoSection({
  hotelInfo,
  onChange,
  showAutoSavedBadge = true,
}: HotelInfoSectionProps): React.ReactElement {
  const { t } = useLanguage();

  return (
    <section id="settings-hotel" className="settings-card hotel-info-section">
      <header className="settings-card__header">
        <div className="settings-card__titles">
          <h2 className="settings-card__title">
            {t('manager.settings.hotel.title')}
          </h2>
          <p className="settings-card__subtitle">
            {t('manager.settings.hotel.subtitle')}
          </p>
        </div>

        {showAutoSavedBadge && (
          <span className="hotel-info-section__badge">
            {t('manager.settings.hotel.autoSaved')}
          </span>
        )}
      </header>

      <div className="hotel-info-section__grid">
        <div className="hotel-info-section__field">
          <label htmlFor="hotel-name" className="hotel-info-section__label">
            {t('manager.settings.hotel.name')}
          </label>
          <input
            id="hotel-name"
            type="text"
            className="hotel-info-section__input"
            value={hotelInfo.hotelName}
            onChange={(e) => onChange({ hotelName: e.target.value })}
          />
        </div>

        <div className="hotel-info-section__field">
          <label htmlFor="hotel-location" className="hotel-info-section__label">
            {t('manager.settings.hotel.location')}
          </label>
          <input
            id="hotel-location"
            type="text"
            className="hotel-info-section__input"
            value={hotelInfo.location}
            onChange={(e) => onChange({ location: e.target.value })}
          />
        </div>

        <div className="hotel-info-section__field">
          <label htmlFor="hotel-floors" className="hotel-info-section__label">
            {t('manager.settings.hotel.floors')}
          </label>
          <input
            id="hotel-floors"
            type="number"
            min={1}
            className="hotel-info-section__input"
            value={hotelInfo.floorsCount}
            onChange={(e) => onChange({ floorsCount: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="hotel-info-section__field">
          <label htmlFor="hotel-rooms" className="hotel-info-section__label">
            {t('manager.settings.hotel.rooms')}
          </label>
          <input
            id="hotel-rooms"
            type="number"
            min={1}
            className="hotel-info-section__input"
            value={hotelInfo.totalRooms}
            onChange={(e) => onChange({ totalRooms: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </section>
  );
}
