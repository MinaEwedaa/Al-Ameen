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
} from '../constants/maintenance.constants';
import type { MaintenanceRequest } from '../types/maintenance.types';
import { formatReference, formatRequestTime, formatTimeAgo, lastUpdateOf } from '../utils/maintenanceDisplay';

interface MaintenanceTableProps {
  requests: MaintenanceRequest[];
  totalRequests: number;
  language: Language;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpenRequest: (issueId: string | number) => void;
}

export function MaintenanceTable({ requests, totalRequests, language, page, totalPages, onPageChange, onOpenRequest }: MaintenanceTableProps) {
  const t = (key: string) => getTranslation(language, key);
  // The arrow points to the side the drawer opens from: right in Arabic, left in English
  const OpenIcon = language === 'ar' ? ChevronRight : ChevronLeft;
  const summary = t('mtListSummary')
    .replace('{rows}', formatNumber(requests.length, language))
    .replace('{total}', formatNumber(totalRequests, language));

  const columns = [
    { key: 'issue_id', label: t('mtColReference'), render: (row: unknown) => (
      <span className="maintenance-table__reference">{formatReference((row as MaintenanceRequest).issue_id, language)}</span>
    ) },
    { key: 'room_id', label: t('colRoom'), render: (row: unknown) => {
      const req = row as MaintenanceRequest;
      const roomDisplay = req.room_number || String(req.room_id);
      return (
        <span className="table-card__chip maintenance-table__room">
          {Number.isFinite(Number(roomDisplay)) ? formatNumber(Number(roomDisplay), language) : roomDisplay}
        </span>
      );
    } },
    { key: 'problem', label: t('mtColIssue'), render: (row: unknown) => (
      <span className="maintenance-table__issue">{(row as MaintenanceRequest).problem}</span>
    ) },
    { key: 'priority', label: t('priorityLabel'), render: (row: unknown) => {
      const request = row as MaintenanceRequest;
      return <Badge tone={PRIORITY_TONE[request.priority]}>{t(PRIORITY_LABEL_KEY[request.priority])}</Badge>;
    } },
    { key: 'status', label: t('statusLabel'), render: (row: unknown) => {
      const request = row as MaintenanceRequest;
      return <Badge tone={STATUS_TONE[request.status]}>{t(STATUS_LABEL_KEY[request.status])}</Badge>;
    } },
    { key: 'created_date', label: t('mtColReportedAt'), render: (row: unknown) => formatRequestTime((row as MaintenanceRequest).created_date, language) },
    { key: 'last_update', label: t('mtColLastUpdate'), render: (row: unknown) => formatTimeAgo(lastUpdateOf(row as MaintenanceRequest), language) },
    { key: 'actions', label: t('colActions'), render: (row: unknown) => {
      const request = row as MaintenanceRequest;
      const roomDisplay = request.room_number || String(request.room_id);
      const formattedRoom = Number.isFinite(Number(roomDisplay)) ? formatNumber(Number(roomDisplay), language) : roomDisplay;
      return (
        <button
          type="button"
          className="table-card__open maintenance-table__open"
          aria-label={t('mtOpenRequest').replace('{room}', formattedRoom)}
          onClick={() => onOpenRequest(request.issue_id)}
        >
          <OpenIcon aria-hidden="true" />
        </button>
      );
    } },
  ];

  return (
    <TableCard
      className="maintenance-table-card"
      title={t('mtListTitle')}
      subtitle={t('mtListSubtitle')}
      badge={`${formatNumber(totalRequests, language)} ${t('mtListCount')}`}
      footer={(
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageLabel={summary}
          previousLabel={t('pagination.previous')}
          nextLabel={t('pagination.next')}
          navigationLabel={t('pagination.label')}
          />
      )}
    >
      <Table columns={columns} rows={requests} emptyMessage={t('mtEmpty')} className="maintenance-table" />
    </TableCard>
  );
}
