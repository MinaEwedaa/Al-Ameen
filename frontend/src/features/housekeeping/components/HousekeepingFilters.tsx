import { FilterBar } from '../../../components/common/FilterBar';
import { Select } from '../../../components/ui/Select';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import {
  PRIORITY_LABEL_KEY,
  PRIORITY_OPTIONS,
  STATUS_LABEL_KEY,
  STATUS_OPTIONS,
} from '../constants/housekeeping.constants';
import type { HousekeepingFilterName, HousekeepingFilters as Filters } from '../types/housekeeping.types';

interface HousekeepingFiltersProps {
  language: Language;
  value: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  floorOptions: string[];
  onFilterChange: (name: HousekeepingFilterName, value: string) => void;
  onReset: () => void;
}

export function HousekeepingFilters({
  language,
  value,
  onSearchChange,
  filters,
  floorOptions,
  onFilterChange,
  onReset,
}: HousekeepingFiltersProps) {
  const t = (key: string) => getTranslation(language, key);
  const all = { value: '', label: t('filterAll') };

  return (
    <FilterBar
      columns={4}
      value={value}
      onChange={onSearchChange}
      placeholder={t('hkSearchRoomCleaner')}
      onReset={onReset}
      resetLabel={t('filterReset')}
    >
      <Select
        label={t('statusLabel')}
        value={filters.status}
        options={[all, ...STATUS_OPTIONS.map((option) => ({ value: option, label: t(STATUS_LABEL_KEY[option]) }))]}
        onChange={(next) => onFilterChange('status', next)}
      />
      <Select
        label={t('priorityLabel')}
        value={filters.priority}
        options={[all, ...PRIORITY_OPTIONS.map((option) => ({ value: option, label: t(PRIORITY_LABEL_KEY[option]) }))]}
        onChange={(next) => onFilterChange('priority', next)}
      />
      <Select
        label={t('floorLabel')}
        value={filters.floor}
        options={[all, ...floorOptions.map((option) => ({ value: option, label: formatNumber(Number(option), language) }))]}
        onChange={(next) => onFilterChange('floor', next)}
      />
    </FilterBar>
  );
}
