import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber, formatPercent } from '../../../utils/format';
import {
  AMENITIES_MAX,
  AMENITY_MAX_LENGTH,
  CAPACITY_MAX,
  DESCRIPTION_MAX_LENGTH,
  PRICE_MAX,
  ROOM_TYPES_I18N,
} from '../constants/roomTypes.constants';
import {
  parseWholeNumber,
  validateAmenities,
  validateCapacity,
  validateDescription,
  validateNewAmenity,
  validatePrice,
} from '../schemas/roomType.schema';
import type { RoomType, RoomTypeUpdate } from '../types/roomType.types';
import { amenityLabel, formatPriceRange, formatThousands, typeName } from '../utils/roomTypeDisplay';
import { RoomTypeField } from './RoomTypeField';
import { RoomTypeStat } from './RoomTypeStat';
import './RoomTypeDrawers.css';

const FORM_ID = 'manager-room-type-manage-form';

interface ManageRoomTypeDrawerProps {
  roomType: RoomType;
  isSaving: boolean;
  onClose: () => void;
  /** Only the fields that changed */
  onSave: (body: RoomTypeUpdate) => void;
}

type FieldErrors = Partial<Record<'basePrice' | 'capacity' | 'description' | 'amenities', string>>;

// "عرض وإدارة النوع" / gear button: base price, capacity, description and amenities (PATCH /room-types/{id}).
// Remounted per type with `key`.
export function ManageRoomTypeDrawer({ roomType, isSaving, onClose, onSave }: ManageRoomTypeDrawerProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${ROOM_TYPES_I18N}.${key}`);
  const baseId = useId();
  const [basePrice, setBasePrice] = useState(String(roomType.base_price));
  const [capacity, setCapacity] = useState(String(roomType.capacity));
  const [description, setDescription] = useState(roomType.description);
  const [amenities, setAmenities] = useState<string[]>(roomType.amenities);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const labels = amenities.map((amenity) => amenityLabel(amenity, t));
  const body: RoomTypeUpdate = {
    ...(parseWholeNumber(basePrice) !== roomType.base_price ? { base_price: parseWholeNumber(basePrice) } : {}),
    ...(parseWholeNumber(capacity) !== roomType.capacity ? { capacity: parseWholeNumber(capacity) } : {}),
    ...(description.trim() !== roomType.description ? { description: description.trim() } : {}),
    ...(amenities.join('|') !== roomType.amenities.join('|') ? { amenities } : {}),
  };
  const changed = Object.keys(body).length > 0;

  const message = (key: string | undefined | null, max?: number) => (key ? t(`errors.${key}`).replace('{max}', formatNumber(max ?? 0, language)) : undefined);

  const addAmenity = () => {
    const error = validateNewAmenity(draft, labels);
    setDraftError(error);
    if (error) {
      document.getElementById(`${baseId}-amenity`)?.focus();
      return;
    }
    setAmenities([...amenities, draft.trim().replace(/\s+/g, ' ')]);
    setDraft('');
    setErrors((current) => ({ ...current, amenities: undefined }));
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addAmenity();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const nextErrors: FieldErrors = {
      basePrice: validatePrice(basePrice) ?? undefined,
      capacity: validateCapacity(capacity) ?? undefined,
      description: validateDescription(description) ?? undefined,
      amenities: validateAmenities(amenities) ?? undefined,
    };
    setErrors(nextErrors);
    const first = (['basePrice', 'capacity', 'description'] as const).find((field) => nextErrors[field]);
    if (first) {
      document.getElementById(`${baseId}-${first}`)?.focus();
      return;
    }
    if (nextErrors.amenities) return;
    onSave(body);
  };

  return (
    <Drawer
      open
      eyebrow={t('manageEyebrow')}
      title={typeName(roomType, t)}
      closeLabel={t('close')}
      onClose={onClose}
      className="room-type-drawer"
      footer={(
        <div className="room-type-drawer__footer">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>{t('cancel')}</Button>
          <Button type="submit" form={FORM_ID} disabled={isSaving || !changed}>{isSaving ? t('saving') : t('saveType')}</Button>
        </div>
      )}
    >
      <form id={FORM_ID} className="room-type-form" onSubmit={handleSubmit} noValidate>
        <div className="room-type-form__stats">
          <RoomTypeStat label={t('occupancy')}>{formatPercent(roomType.occupancy_rate_pct, language)}</RoomTypeStat>
          <RoomTypeStat label={t('monthlyRevenue')}>{formatThousands(roomType.revenue_month_to_date, language, t)}</RoomTypeStat>
          <RoomTypeStat label={t('roomsCount')}>{formatNumber(roomType.rooms_count, language)}</RoomTypeStat>
        </div>

        <section className="room-type-form__section">
          <h3>{t('pricingAndCapacity')}</h3>
          <div className="room-type-form__row">
            <RoomTypeField
              id={`${baseId}-basePrice`}
              label={t('basePrice')}
              value={basePrice}
              suffix={t('perNight')}
              inputMode="numeric"
              maxLength={7}
              disabled={isSaving}
              error={message(errors.basePrice, PRICE_MAX)}
              hint={t('currentRange').replace('{range}', formatPriceRange(roomType.price_min, roomType.price_max, language))}
              onChange={(value) => { setBasePrice(value); setErrors((current) => ({ ...current, basePrice: undefined })); }}
            />
            <RoomTypeField
              id={`${baseId}-capacity`}
              label={t('capacity')}
              value={capacity}
              suffix={t('guests')}
              inputMode="numeric"
              maxLength={2}
              disabled={isSaving}
              error={message(errors.capacity, CAPACITY_MAX)}
              onChange={(value) => { setCapacity(value); setErrors((current) => ({ ...current, capacity: undefined })); }}
            />
          </div>
          <label className="room-type-form__field" htmlFor={`${baseId}-description`}>
            <span>{t('descriptionLabel')}</span>
            <textarea
              id={`${baseId}-description`}
              rows={3}
              dir="auto"
              value={description}
              maxLength={DESCRIPTION_MAX_LENGTH + 20}
              disabled={isSaving}
              aria-invalid={errors.description ? true : undefined}
              className={errors.description ? 'room-type-form__control--error' : undefined}
              onChange={(event) => { setDescription(event.target.value); setErrors((current) => ({ ...current, description: undefined })); }}
            />
            {errors.description && <span className="room-type-form__error">{message(errors.description, DESCRIPTION_MAX_LENGTH)}</span>}
          </label>
        </section>

        <section className="room-type-form__section">
          <h3>{t('amenitiesLabel')}</h3>
          {amenities.length > 0 ? (
            <ul className="room-type-form__chips">
              {amenities.map((amenity) => (
                <li key={amenity}>
                  <span dir="auto">{amenityLabel(amenity, t)}</span>
                  <button
                    type="button"
                    aria-label={t('removeAmenity').replace('{name}', amenityLabel(amenity, t))}
                    disabled={isSaving}
                    onClick={() => setAmenities(amenities.filter((item) => item !== amenity))}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="room-type-form__hint">{t('noAmenities')}</p>
          )}
          <div className="room-type-form__add">
            <RoomTypeField
              id={`${baseId}-amenity`}
              label={t('newAmenity')}
              value={draft}
              placeholder={t('newAmenityPlaceholder')}
              maxLength={AMENITY_MAX_LENGTH + 10}
              disabled={isSaving}
              error={message(draftError, draftError === 'amenitiesFull' ? AMENITIES_MAX : AMENITY_MAX_LENGTH)}
              onChange={(value) => { setDraft(value); if (draftError) setDraftError(null); }}
              onKeyDown={onDraftKeyDown}
            />
            <Button variant="secondary" onClick={addAmenity} disabled={isSaving}>
              <Plus aria-hidden="true" />
              {t('addAmenity')}
            </Button>
          </div>
          {errors.amenities && <span className="room-type-form__error">{message(errors.amenities)}</span>}
        </section>
      </form>
    </Drawer>
  );
}
