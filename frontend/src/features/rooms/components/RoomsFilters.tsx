import { FilterBar } from '../../../components/common/FilterBar';
import { Select } from '../../../components/ui/Select';
import { getTranslation, type Language } from '../../../core/i18n';
import { ROOM_AVAILABILITY_OPTIONS, ROOM_FLOOR_OPTIONS, ROOM_STATUS_OPTIONS, ROOM_TYPE_OPTIONS } from '../constants/roomOptions';
import type { RoomFilters } from '../types/room.types';

interface RoomsFiltersProps {
  language: Language;
  value: string;
  onSearchChange: (value: string) => void;
  filters: RoomFilters;
  onFilterChange: (name: 'type' | 'status' | 'floor' | 'availability', value: string) => void;
  onReset: () => void;
}

export function RoomsFilters({ language, value, onSearchChange, filters, onFilterChange, onReset }: RoomsFiltersProps) {
  const t = (key: string) => getTranslation(language, key);
  const options = (items: Array<{ value: string | number; labelKey: string }>) => items.map((item) => ({ value: String(item.value), label: t(item.labelKey) }));

  return (
    <FilterBar
      columns={5}
      value={value}
      onChange={onSearchChange}
      placeholder={t('rooms.filters.search')}
      onReset={onReset}
      resetLabel={t('rooms.filters.reset')}
    >
      <Select label={t('rooms.filters.type')} value={filters.type} options={options(ROOM_TYPE_OPTIONS)} onChange={(next) => onFilterChange('type', next)} />
      <Select label={t('rooms.filters.status')} value={filters.status} options={options(ROOM_STATUS_OPTIONS)} onChange={(next) => onFilterChange('status', next)} />
      <Select label={t('rooms.filters.floor')} value={filters.floor === '' ? '' : String(filters.floor)} options={options(ROOM_FLOOR_OPTIONS)} onChange={(next) => onFilterChange('floor', next)} />
      <Select label={t('rooms.filters.availability')} value={filters.availability} options={options(ROOM_AVAILABILITY_OPTIONS)} onChange={(next) => onFilterChange('availability', next)} />
    </FilterBar>
  );
}
