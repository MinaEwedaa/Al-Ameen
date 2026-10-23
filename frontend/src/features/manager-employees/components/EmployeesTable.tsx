import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TableCard } from '../../../components/common/TableCard';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { EMPLOYEES_I18N, STATUS_TONE } from '../constants/employees.constants';
import type { Staff } from '../types/employee.types';
import { employeeStatus, pluralText } from '../utils/employeeDisplay';
import { EmployeeAvatar } from './EmployeeAvatar';
import './EmployeesTable.css';

interface EmployeesTableProps {
  employees: Staff[];
  totalEmployees: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpen: (id: string) => void;
}

export function EmployeesTable({ employees, totalEmployees, page, totalPages, onPageChange, onOpen }: EmployeesTableProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${EMPLOYEES_I18N}.${key}`);
  // The arrow points to the side the drawer opens from
  const OpenIcon = language === 'ar' ? ChevronRight : ChevronLeft;
  const count = (value: number | undefined) => (value ? formatNumber(value, language) : '—');

  const columns = [
    { key: 'employee', label: t('colEmployee'), render: (row: unknown) => {
      const member = row as Staff;
      return (
        <span className="employees-table__person">
          <EmployeeAvatar name={member.full_name} />
          <span>{member.full_name}</span>
        </span>
      );
    } },
    { key: 'role', label: t('colRole'), render: (row: unknown) => t(`roles.${(row as Staff).staff_type}`) },
    { key: 'shift', label: t('colShift'), render: (row: unknown) => {
      const shift = (row as Staff).today_shift;
      return shift ? t(`shifts.${shift.shift_type}`) : <span className="employees-table__muted">{t('shifts.NONE')}</span>;
    } },
    { key: 'tasks', label: t('colTasks'), render: (row: unknown) => formatNumber((row as Staff).workload?.assigned_today ?? 0, language) },
    { key: 'completed', label: t('colCompleted'), render: (row: unknown) => count((row as Staff).workload?.completed_today) },
    { key: 'pending', label: t('colPending'), render: (row: unknown) => count((row as Staff).workload?.open) },
    { key: 'status', label: t('colStatus'), render: (row: unknown) => {
      const status = employeeStatus(row as Staff);
      return <Badge tone={STATUS_TONE[status]}>{t(`statuses.${status}`)}</Badge>;
    } },
    { key: 'actions', label: t('colActions'), render: (row: unknown) => {
      const member = row as Staff;
      return (
        <button
          type="button"
          className="table-card__open employees-table__open"
          aria-label={t('openEmployee').replace('{name}', member.full_name)}
          onClick={() => onOpen(member.staff_id)}
        >
          <OpenIcon aria-hidden="true" />
        </button>
      );
    } },
  ];

  return (
    <TableCard
      className="employees-table-card"
      title={t('directoryTitle')}
      subtitle={t('directorySubtitle')}
      badge={pluralText(t, 'employeesCount', totalEmployees, language)}
      footer={totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageLabel={t('pageLabel').replace('{page}', formatNumber(page, language)).replace('{total}', formatNumber(totalPages, language))}
          previousLabel={t('previousPage')}
          nextLabel={t('nextPage')}
          navigationLabel={t('pagination')}
        />
      ) : undefined}
    >
      <Table columns={columns} rows={employees} emptyMessage={t('emptyTitle')} className="employees-table" />
    </TableCard>
  );
}
