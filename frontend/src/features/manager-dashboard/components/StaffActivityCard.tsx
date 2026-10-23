import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { StaffAvatar } from './StaffAvatar';
import { translateOr } from '../utils/dashboardLabels';
import type { StaffActivityOverview, StaffActivityItem } from '../types/manager-dashboard.types';
import './StaffActivityCard.css';

export interface StaffActivityCardProps {
  staffActivity: StaffActivityOverview;
  className?: string;
}

type StaffTableColumnKey = 'employee' | 'role' | 'shift' | 'completed' | 'pending' | 'status';

export function StaffActivityCard({ staffActivity, className = '' }: StaffActivityCardProps) {
  const { language, t } = useLanguage();

  const workingBadgeText =
    language === 'ar'
      ? `${formatNumber(staffActivity.activeStaffCount, language)} يعملون الآن`
      : `${staffActivity.activeStaffCount} working now`;

  const columns: Array<{
    key: StaffTableColumnKey;
    label: string;
    render?: (row: unknown) => React.ReactNode;
  }> = [
    {
      key: 'employee',
      label: t('manager.dashboard.staffActivityCard.table.employee'),
      render: (row) => {
        const item = row as StaffActivityItem;
        return (
          <div className="staff-activity-card__employee-cell">
            <StaffAvatar letter={item.avatarLetter} />
            <bdi className="staff-activity-card__employee-name">{item.name}</bdi>
          </div>
        );
      },
    },
    {
      key: 'role',
      label: t('manager.dashboard.staffActivityCard.table.role'),
      render: (row) => {
        const item = row as StaffActivityItem;
        return <span>{item.roleType ? translateOr(t, `manager.dashboard.roles.${item.roleType}`, item.role) : item.role}</span>;
      },
    },
    {
      key: 'shift',
      label: t('manager.dashboard.staffActivityCard.table.shift'),
      render: (row) => {
        const item = row as StaffActivityItem;
        return <span>{item.shiftType ? translateOr(t, `manager.dashboard.shiftShort.${item.shiftType}`, item.shift) : item.shift}</span>;
      },
    },
    {
      key: 'completed',
      label: t('manager.dashboard.staffActivityCard.table.completed'),
      render: (row) => {
        const item = row as StaffActivityItem;
        return (
          <span>
            {item.completedTasks !== null
              ? formatNumber(item.completedTasks, language)
              : '—'}
          </span>
        );
      },
    },
    {
      key: 'pending',
      label: t('manager.dashboard.staffActivityCard.table.pending'),
      render: (row) => {
        const item = row as StaffActivityItem;
        return <span>{formatNumber(item.pendingTasks, language)}</span>;
      },
    },
    {
      key: 'status',
      label: t('manager.dashboard.staffActivityCard.table.status'),
      render: (row) => {
        const item = row as StaffActivityItem;
        const statusKey = `manager.dashboard.staffActivityCard.status.${item.status}`;
        const statusLabel = t(statusKey) || item.statusLabel;

        return (
          <span
            className={`staff-activity-card__status-badge staff-activity-card__status-badge--${item.status}`}
          >
            {statusLabel}
          </span>
        );
      },
    },
  ];

  return (
    <Card className={`staff-activity-card ${className}`.trim()}>
      <header className="staff-activity-card__header">
        <div className="staff-activity-card__title-group">
          <h3 className="staff-activity-card__title">
            {t('manager.dashboard.staffActivityCard.title')}
          </h3>
          <p className="staff-activity-card__subtitle">
            {t('manager.dashboard.staffActivityCard.subtitle')}
          </p>
        </div>
        <span className="staff-activity-card__badge">{workingBadgeText}</span>
      </header>

      <div className="staff-activity-card__table-wrapper">
        <Table<StaffTableColumnKey>
          columns={columns}
          rows={staffActivity.staffList}
          emptyMessage={t('noData')}
        />
      </div>
    </Card>
  );
}
