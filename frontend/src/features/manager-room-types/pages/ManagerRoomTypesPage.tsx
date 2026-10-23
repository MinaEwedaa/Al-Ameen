import { useCallback, useMemo } from 'react';
import { FileText, Settings } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { PageHero } from '../../../components/common/PageHero';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/ToastContext';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { exportCsv } from '../../../utils/exportCsv';
import { ManageRoomTypeDrawer } from '../components/ManageRoomTypeDrawer';
import { PricesDrawer } from '../components/PricesDrawer';
import { RoomTypeCard } from '../components/RoomTypeCard';
import { PARAM_PRICES, PARAM_TYPE, ROOM_TYPES_I18N } from '../constants/roomTypes.constants';
import { useRoomTypes, useUpdateBasePrices, useUpdateRoomType } from '../hooks/useRoomTypes';
import type { RoomType, RoomTypeUpdate } from '../types/roomType.types';
import { amenityLabel, apiErrorText, isPremium, typeName } from '../utils/roomTypeDisplay';
import './ManagerRoomTypesPage.css';

// URL params: prices=1 (update prices drawer), type=<id> (manage drawer)
export function ManagerRoomTypesPage() {
  const { language, t: translate } = useLanguage();
  const t = useCallback((key: string) => translate(`${ROOM_TYPES_I18N}.${key}`), [translate]);
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const roomTypesQuery = useRoomTypes();
  const updateRoomType = useUpdateRoomType();
  const updatePrices = useUpdateBasePrices();
  const roomTypes = useMemo(
    // The basic category first, as in the design
    () => [...(roomTypesQuery.data ?? [])].sort((a, b) => Number(isPremium(a)) - Number(isPremium(b)) || a.base_price - b.base_price),
    [roomTypesQuery.data],
  );

  const isPricesOpen = searchParams.get(PARAM_PRICES) === '1';
  const selectedType = roomTypes.find((type) => type.room_type_id === searchParams.get(PARAM_TYPE)) ?? null;

  const setDrawer = (name: string | null, value?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete(PARAM_PRICES);
      next.delete(PARAM_TYPE);
      if (name && value) next.set(name, value);
      return next;
    });
  };

  async function savePrices(prices: Array<{ id: string; base_price: number }>) {
    try {
      await updatePrices.mutateAsync(prices);
      setDrawer(null);
      toast.notify(t('toastPricesSaved'), 'success');
    } catch (error) {
      toast.notify(apiErrorText(error, t, language), 'error');
    }
  }

  async function saveType(body: RoomTypeUpdate) {
    if (!selectedType) return;
    try {
      await updateRoomType.mutateAsync({ id: selectedType.room_type_id, body });
      setDrawer(null);
      toast.notify(t('toastTypeSaved').replace('{name}', typeName(selectedType, t)), 'success');
    } catch (error) {
      toast.notify(apiErrorText(error, t, language), 'error');
    }
  }

  function exportTypes() {
    if (roomTypes.length === 0) {
      toast.notify(t('toastNothingToExport'), 'warning');
      return;
    }
    const done = exportCsv<RoomType>(roomTypes, [
      { header: t('colName'), value: (type) => typeName(type, t) },
      { header: t('colCategory'), value: (type) => t(isPremium(type) ? 'tierPremium' : 'tierBasic') },
      { header: t('roomsCount'), value: (type) => type.rooms_count },
      { header: t('capacity'), value: (type) => type.capacity },
      { header: t('basePrice'), value: (type) => type.base_price },
      { header: t('priceFrom'), value: (type) => type.price_min },
      { header: t('priceTo'), value: (type) => type.price_max },
      { header: t('amenitiesLabel'), value: (type) => type.amenities.map((amenity) => amenityLabel(amenity, t)).join(' / ') },
      { header: t('occupancy'), value: (type) => `${type.occupancy_rate_pct}%` },
      { header: t('monthlyRevenue'), value: (type) => type.revenue_month_to_date },
    ], `room-types-${new Date().toISOString().slice(0, 10)}.csv`);
    if (done) toast.notify(t('toastExported'), 'success');
  }

  const hero = (withActions: boolean) => (
    <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('description')}>
      {withActions && (
        <>
          <Button variant="glass" onClick={exportTypes}>
            <FileText aria-hidden="true" />
            {t('export')}
          </Button>
          <Button variant="gold" onClick={() => setDrawer(PARAM_PRICES, '1')} disabled={roomTypes.length === 0}>
            <Settings aria-hidden="true" />
            {t('updatePrices')}
          </Button>
        </>
      )}
    </PageHero>
  );

  if (roomTypesQuery.isPending) {
    return <div className="feature-page manager-room-types">{hero(false)}<LoadingState label={t('loading')} /></div>;
  }

  if (roomTypesQuery.isError) {
    return (
      <div className="feature-page manager-room-types">
        {hero(false)}
        <ErrorState
          title={t('loadError')}
          message={apiErrorText(roomTypesQuery.error, t, language)}
          action={<Button onClick={() => { void roomTypesQuery.refetch(); }}>{t('retry')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="feature-page manager-room-types">
      {hero(true)}

      {roomTypes.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="manager-room-types__grid">
          {roomTypes.map((type) => (
            <RoomTypeCard key={type.room_type_id} roomType={type} onManage={() => setDrawer(PARAM_TYPE, type.room_type_id)} />
          ))}
        </div>
      )}

      <PricesDrawer
        key={isPricesOpen ? 'prices-open' : 'prices-closed'}
        open={isPricesOpen}
        roomTypes={roomTypes}
        isSaving={updatePrices.isPending}
        onClose={() => setDrawer(null)}
        onSave={(prices) => { void savePrices(prices); }}
      />
      {selectedType && (
        <ManageRoomTypeDrawer
          key={selectedType.room_type_id}
          roomType={selectedType}
          isSaving={updateRoomType.isPending}
          onClose={() => setDrawer(null)}
          onSave={(body) => { void saveType(body); }}
        />
      )}
    </div>
  );
}
