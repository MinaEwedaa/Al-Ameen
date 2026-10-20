import { FilterBar } from '../../../components/common/FilterBar';
import { Select } from '../../../components/ui/Select';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import {
  PRIORITY_LABEL_KEY,
  PRIORITY_OPTIONS,
  STATUS_LABEL_KEY,
  STATUS_OPTIONS,
} from '../constants/maintenance.constants';
import type { MaintenanceFilterName, MaintenanceFilters as Filters } from '../types/maintenance.types';

interface MaintenanceFiltersProps {
  language: Language;
  value: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  roomOptions: string[];
  onFilterChange: (name: MaintenanceFilterName, value: string) => void;
  onReset: () => void;
}

export function MaintenanceFilters({
  language,
  value,
  onSearchChange,
  filters,
  roomOptions,
  onFilterChange,
  onReset,
}: MaintenanceFiltersProps) {
  const t = (key: string) => getTranslation(language, key);
  const all = { value: '', label: t('filterAll') };

  return (
    <FilterBar
      columns={4}
      value={value}
      onChange={onSearchChange}
      placeholder={t('mtSearch')}
      onReset={onReset}
      resetLabel={t('filterReset')}
    >
      <Select
        label={t('roomNumberLabel')}
        value={filters.room}
        options={[all, ...roomOptions.map((room) => ({ value: room, label: formatNumber(Number(room), language) }))]}
        onChange={(next) => onFilterChange('room', next)}
      />
      <Select
        label={t('priorityLabel')}
        value={filters.priority}
        options={[all, ...PRIORITY_OPTIONS.map((option) => ({ value: option, label: t(PRIORITY_LABEL_KEY[option]) }))]}
        onChange={(next) => onFilterChange('priority', next)}
      />
      <Select
        label={t('statusLabel')}
        value={filters.status}
        options={[all, ...STATUS_OPTIONS.map((option) => ({ value: option, label: t(STATUS_LABEL_KEY[option]) }))]}
        onChange={(next) => onFilterChange('status', next)}
      />
    </FilterBar>
  );
}
