import { FilterBar } from '../../../components/common/FilterBar';
import { Select } from '../../../components/ui/Select';
import { getTranslation, type Language } from '../../../core/i18n';
import { PAYMENT_METHODS } from '../../../core/constants/paymentMethods';
import { STATUS } from '../../../core/constants/status';
import { formatNumber } from '../../../utils/format';
import { methodLabelKey, statusLabelKey } from '../utils/paymentsLabels';
import { rangeToDates, type PaymentsDateRange } from '../utils/paymentsDateRange';

export type { PaymentsDateRange } from '../utils/paymentsDateRange';

export interface PaymentsFilterValues {
  query: string;
  room: string;
  method: string;
  status: string;
  /** Picked from the "date" dropdown; turned into from/to by the page */
  range: PaymentsDateRange;
  from: string;
  to: string;
}

interface PaymentsFiltersProps {
  language: Language;
  values: PaymentsFilterValues;
  roomOptions: string[];
  onChange: (values: PaymentsFilterValues) => void;
  onReset: () => void;
}

export function PaymentsFilters({ language, values, roomOptions, onChange, onReset }: PaymentsFiltersProps) {
  const t = (key: string) => getTranslation(language, key);
  const update = (patch: Partial<PaymentsFilterValues>) => onChange({ ...values, ...patch });
  const all = { value: 'all', label: t('paymentsPage.filters.all') };
  const label = (key: string | null, fallback: string) => (key ? t(key) : fallback);

  return (
    <FilterBar
      columns={5}
      value={values.query}
      onChange={(query) => update({ query })}
      placeholder={t('paymentsPage.filters.search')}
      onReset={onReset}
      resetLabel={t('paymentsPage.filters.reset')}
    >
      <Select
        label={t('paymentsPage.filters.room')}
        value={values.room}
        options={[all, ...roomOptions.map((room) => ({ value: room, label: /^\d+$/.test(room) ? formatNumber(Number(room), language) : room }))]}
        onChange={(room) => update({ room })}
      />
      <Select
        label={t('paymentsPage.filters.method')}
        value={values.method}
        options={[all, ...Object.values(PAYMENT_METHODS).map((method) => ({ value: method, label: label(methodLabelKey(method), method) }))]}
        onChange={(method) => update({ method })}
      />
      <Select
        label={t('paymentsPage.filters.date')}
        value={values.range}
        options={[
          all,
          { value: 'today', label: t('paymentsPage.filters.today') },
          { value: 'week', label: t('paymentsPage.filters.week') },
          { value: 'month', label: t('paymentsPage.filters.month') },
        ]}
        onChange={(range) => update({ range: range as PaymentsDateRange, ...rangeToDates(range as PaymentsDateRange) })}
      />
      <Select
        label={t('paymentsPage.filters.status')}
        value={values.status}
        options={[all, ...Object.values(STATUS).map((status) => ({ value: status, label: label(statusLabelKey(status), status) }))]}
        onChange={(status) => update({ status })}
      />
    </FilterBar>
  );
}
