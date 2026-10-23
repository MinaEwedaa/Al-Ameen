import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TableCard } from '../../../components/common/TableCard';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/Table';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatCurrency, formatNumber } from '../../../utils/format';
import { REVIEW_STATUS_TONE, SHIFTS_I18N } from '../constants/shifts.constants';
import type { ShiftReport } from '../types/shift.types';
import { formatDay, pluralText } from '../utils/shiftDisplay';
import './HandoversTable.css';

interface HandoversTableProps {
  reports: ShiftReport[];
  onOpen: (reportId: string) => void;
}

// "تسليمات الوردية": GET /shift-reports. A missing optional field shows "—" (request S2 to the backend).
export function HandoversTable({ reports, onOpen }: HandoversTableProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${SHIFTS_I18N}.${key}`);
  const OpenIcon = language === 'ar' ? ChevronRight : ChevronLeft;
  const count = (value: number | undefined) => (value === undefined ? '—' : formatNumber(value, language));

  const columns = [
    { key: 'shift', label: t('cols.shift'), render: (row: unknown) => {
      const report = row as ShiftReport;
      return <strong className="handovers-table__shift">{report.shift_type ? t(`names.${report.shift_type}`) : '—'}</strong>;
    } },
    { key: 'employee', label: t('cols.employee'), render: (row: unknown) => (row as ShiftReport).staff_name ?? '—' },
    { key: 'date', label: t('cols.date'), render: (row: unknown) => formatDay((row as ShiftReport).business_date, language) },
    { key: 'rooms', label: t('cols.rooms'), render: (row: unknown) => {
      const rooms = (row as ShiftReport).rooms_handled;
      return rooms === undefined ? '—' : pluralText(t, 'units.rooms', rooms, language);
    } },
    { key: 'payments', label: t('cols.payments'), render: (row: unknown) => formatCurrency((row as ShiftReport).gross_revenue, language) },
    { key: 'maintenance', label: t('cols.maintenance'), render: (row: unknown) => count((row as ShiftReport).maintenance_requests) },
    { key: 'cleaning', label: t('cols.cleaning'), render: (row: unknown) => count((row as ShiftReport).cleaning_tasks) },
    { key: 'pending', label: t('cols.pending'), render: (row: unknown) => count((row as ShiftReport).pending_items) },
    { key: 'status', label: t('cols.status'), render: (row: unknown) => {
      const report = row as ShiftReport;
      return <Badge tone={REVIEW_STATUS_TONE[report.review_status]}>{t(`review.${report.review_status}`)}</Badge>;
    } },
    { key: 'actions', label: t('cols.actions'), render: (row: unknown) => {
      const report = row as ShiftReport;
      return (
        <button
          type="button"
          className="table-card__open"
          aria-label={t('openReport').replace('{date}', formatDay(report.business_date, language))}
          onClick={() => onOpen(report.report_id)}
        >
          <OpenIcon aria-hidden="true" />
        </button>
      );
    } },
  ];

  return (
    <TableCard
      className="handovers-table-card"
      title={t('handoversTitle')}
      subtitle={t('handoversSubtitle')}
      badge={pluralText(t, 'units.reportsCount', reports.length, language)}
    >
      <Table columns={columns} rows={reports} emptyMessage={t('handoversEmpty')} className="handovers-table" />
    </TableCard>
  );
}
