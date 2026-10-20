import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { TableCard } from '../../../components/common/TableCard';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import {
  PRIORITY_LABEL_KEY,
  PRIORITY_TONE,
  STATUS_LABEL_KEY,
  STATUS_TONE,
} from '../constants/housekeeping.constants';
import type { HousekeepingTask } from '../types/housekeeping.types';
import { formatTaskTime } from '../utils/housekeepingDisplay';

interface HousekeepingTableProps {
  tasks: HousekeepingTask[];
  totalTasks: number;
  language: Language;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpenTask: (taskId: string | number) => void;
}

export function HousekeepingTable({ tasks, totalTasks, language, page, totalPages, onPageChange, onOpenTask }: HousekeepingTableProps) {
  const t = (key: string) => getTranslation(language, key);
  // The arrow points to the side the drawer opens from: right in Arabic, left in English
  const OpenIcon = language === 'ar' ? ChevronRight : ChevronLeft;
  const summary = t('hkListSummary')
    .replace('{rows}', formatNumber(tasks.length, language))
    .replace('{total}', formatNumber(totalTasks, language));
  const pageLabel = t('hkPage')
    .replace('{page}', formatNumber(page, language))
    .replace('{total}', formatNumber(totalPages, language));

  const columns = [
    { key: 'room_id', label: t('colRoom'), render: (row: unknown) => {
      const task = row as HousekeepingTask;
      const roomDisplay = task.room_number || String(task.room_id);
      return (
        <span className="table-card__chip housekeeping-table__room">
          {Number.isFinite(Number(roomDisplay)) ? formatNumber(Number(roomDisplay), language) : roomDisplay}
        </span>
      );
    } },
    { key: 'cleaner_name', label: t('hkCleaner'), render: (row: unknown) => (row as HousekeepingTask).cleaner_name || '—' },
    { key: 'priority', label: t('priorityLabel'), render: (row: unknown) => {
      const task = row as HousekeepingTask;
      return <Badge tone={PRIORITY_TONE[task.priority]}>{t(PRIORITY_LABEL_KEY[task.priority])}</Badge>;
    } },
    { key: 'status', label: t('statusLabel'), render: (row: unknown) => {
      const task = row as HousekeepingTask;
      return <Badge tone={STATUS_TONE[task.status]}>{t(STATUS_LABEL_KEY[task.status])}</Badge>;
    } },
    { key: 'assigned_date', label: t('hkColCreatedAt'), render: (row: unknown) => formatTaskTime((row as HousekeepingTask).assigned_date, language) },
    { key: 'actions', label: t('colActions'), render: (row: unknown) => {
      const task = row as HousekeepingTask;
      const roomDisplay = task.room_number || String(task.room_id);
      const formattedRoom = Number.isFinite(Number(roomDisplay)) ? formatNumber(Number(roomDisplay), language) : roomDisplay;
      return (
        <button
          type="button"
          className="table-card__open housekeeping-table__open"
          aria-label={t('hkOpenTask').replace('{room}', formattedRoom)}
          onClick={() => onOpenTask(task.task_id)}
        >
          <OpenIcon aria-hidden="true" />
        </button>
      );
    } },
  ];

  return (
    <TableCard
      className="housekeeping-table-card"
      title={t('hkListTitle')}
      subtitle={summary}
      badge={`${formatNumber(totalTasks, language)} ${t('hkListCount')}`}
      footer={(
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageLabel={pageLabel}
          previousLabel={t('pagination.previous')}
          nextLabel={t('pagination.next')}
          navigationLabel={t('pagination.label')}
          />
      )}
    >
      <Table columns={columns} rows={tasks} emptyMessage={t('hkEmpty')} className="housekeeping-table" />
    </TableCard>
  );
}
