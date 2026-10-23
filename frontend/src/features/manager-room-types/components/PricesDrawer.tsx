import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { PRICE_MAX, ROOM_TYPES_I18N } from '../constants/roomTypes.constants';
import { parseWholeNumber, validatePrice } from '../schemas/roomType.schema';
import type { RoomType } from '../types/roomType.types';
import { formatPriceRange, isPremium, typeName } from '../utils/roomTypeDisplay';
import { RoomTypeField } from './RoomTypeField';
import './RoomTypeDrawers.css';

const FORM_ID = 'manager-room-type-prices-form';

interface PricesDrawerProps {
  open: boolean;
  roomTypes: RoomType[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (prices: Array<{ id: string; base_price: number }>) => void;
}

// "تحديث الأسعار": the base price of every type in one form. Contract v1.1: the "من–إلى" range on the cards
// is computed from each room's own price, so it is shown here read-only. Remounted with `key` on every open.
export function PricesDrawer({ open, roomTypes, isSaving, onClose, onSave }: PricesDrawerProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${ROOM_TYPES_I18N}.${key}`);
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(roomTypes.map((type) => [type.room_type_id, String(type.base_price)])),
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitted, setSubmitted] = useState(false);

  const validateAll = (next: Record<string, string>) => Object.fromEntries(
    roomTypes.map((type) => [type.room_type_id, validatePrice(next[type.room_type_id] ?? '')]),
  );
  const changed = roomTypes.filter((type) => parseWholeNumber(values[type.room_type_id] ?? '') !== type.base_price);

  const setField = (id: string, value: string) => {
    const next = { ...values, [id]: value };
    setValues(next);
    if (submitted) setErrors(validateAll(next));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setSubmitted(true);
    const nextErrors = validateAll(values);
    setErrors(nextErrors);
    const firstInvalid = roomTypes.find((type) => nextErrors[type.room_type_id]);
    if (firstInvalid) {
      document.getElementById(`prices-${firstInvalid.room_type_id}`)?.focus();
      return;
    }
    onSave(changed.map((type) => ({ id: type.room_type_id, base_price: parseWholeNumber(values[type.room_type_id]) })));
  };

  return (
    <Drawer
      open={open}
      eyebrow={t('pricesEyebrow')}
      title={t('pricesTitle')}
      closeLabel={t('close')}
      onClose={onClose}
      className="room-type-drawer"
      footer={(
        <div className="room-type-drawer__footer">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>{t('cancel')}</Button>
          <Button type="submit" form={FORM_ID} disabled={isSaving || changed.length === 0}>{isSaving ? t('saving') : t('savePrices')}</Button>
        </div>
      )}
    >
      <form id={FORM_ID} className="room-type-form" onSubmit={handleSubmit} noValidate>
        <p className="room-type-form__hint">{t('pricesHint')}</p>
        {roomTypes.map((type) => {
          const error = errors[type.room_type_id];
          return (
            <section key={type.room_type_id} className={`room-type-form__section${isPremium(type) ? ' room-type-form__section--vip' : ''}`}>
              <h3>{typeName(type, t)}</h3>
              <RoomTypeField
                id={`prices-${type.room_type_id}`}
                label={t('basePrice')}
                value={values[type.room_type_id] ?? ''}
                suffix={t('perNight')}
                inputMode="numeric"
                maxLength={7}
                disabled={isSaving}
                error={error ? t(`errors.${error}`).replace('{max}', formatNumber(PRICE_MAX, language)) : undefined}
                hint={t('currentRange').replace('{range}', formatPriceRange(type.price_min, type.price_max, language))}
                onChange={(value) => setField(type.room_type_id, value)}
              />
            </section>
          );
        })}
      </form>
    </Drawer>
  );
}
