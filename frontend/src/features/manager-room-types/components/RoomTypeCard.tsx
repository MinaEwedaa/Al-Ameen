import { Bed, Check, ChevronLeft, ChevronRight, ReceiptText, Settings } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatCurrency, formatNumber, formatPercent } from '../../../utils/format';
import { ROOM_TYPES_I18N } from '../constants/roomTypes.constants';
import type { RoomType } from '../types/roomType.types';
import { amenityLabel, formatPriceRange, formatThousands, isPremium, typeName } from '../utils/roomTypeDisplay';
import { RoomTypeStat } from './RoomTypeStat';
import './RoomTypeCard.css';

interface RoomTypeCardProps {
  roomType: RoomType;
  onManage: () => void;
}

// One room category (image 6): price range of its rooms, amenities, 3 stats and the manage actions
export function RoomTypeCard({ roomType, onManage }: RoomTypeCardProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${ROOM_TYPES_I18N}.${key}`);
  const premium = isPremium(roomType);
  const name = typeName(roomType, t);
  const Icon = premium ? ReceiptText : Bed;
  const Chevron = language === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <Card className={`room-type-card${premium ? ' room-type-card--vip' : ''}`}>
      <header className="room-type-card__header">
        <span className="room-type-card__icon" aria-hidden="true"><Icon /></span>
        <div className="room-type-card__title">
          <span className="room-type-card__eyebrow">{t(premium ? 'tierPremium' : 'tierBasic')}</span>
          <h2>{name}</h2>
          <small>
            {t('cardSubtitle').replace('{count}', formatNumber(roomType.rooms_count, language))}
          </small>
        </div>
        <button
          type="button"
          className="room-type-card__gear"
          aria-label={t('manageAria').replace('{name}', name)}
          onClick={onManage}
        >
          <Settings aria-hidden="true" />
        </button>
      </header>

      <div className="room-type-card__price">
        <span>{t('priceRange')}</span>
        <p>
          <strong dir="auto">{formatPriceRange(roomType.price_min, roomType.price_max, language)}</strong>
          <small>{t('perNight')}</small>
        </p>
        <span className="room-type-card__base">{t('basePriceLine')
          .replace('{price}', formatCurrency(roomType.base_price, language))
          .replace('{capacity}', formatNumber(roomType.capacity, language))}</span>
      </div>

      {roomType.amenities.length > 0 ? (
        <ul className="room-type-card__amenities" aria-label={t('amenitiesLabel')}>
          {roomType.amenities.map((amenity) => (
            <li key={amenity}>
              <Check aria-hidden="true" />
              <span dir="auto">{amenityLabel(amenity, t)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="room-type-card__empty">{t('noAmenities')}</p>
      )}

      <div className="room-type-card__stats">
        <RoomTypeStat label={t('occupancy')}>{formatPercent(roomType.occupancy_rate_pct, language)}</RoomTypeStat>
        <RoomTypeStat label={t('monthlyRevenue')}>{formatThousands(roomType.revenue_month_to_date, language, t)}</RoomTypeStat>
        <RoomTypeStat label={t('roomsCount')}>{formatNumber(roomType.rooms_count, language)}</RoomTypeStat>
      </div>

      <button type="button" className="room-type-card__manage" onClick={onManage}>
        <span>{t('viewManage')}</span>
        <Chevron aria-hidden="true" />
      </button>
    </Card>
  );
}
