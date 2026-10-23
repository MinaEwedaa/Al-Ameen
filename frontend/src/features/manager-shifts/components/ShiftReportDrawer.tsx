import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useToast } from '../../../components/ui/ToastContext';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { exportCsv } from '../../../utils/exportCsv';
import { formatCurrency, formatNumber } from '../../../utils/format';
import { SHIFTS_I18N } from '../constants/shifts.constants';
import { useShiftActivities, useShiftReport, useShiftTeam } from '../hooks/useShifts';
import type { ShiftOverview } from '../types/shift.types';
import { formatClock, formatShiftRange, handoverKey, pluralText, reportMoneyRows } from '../utils/shiftDisplay';
import { ShiftInfoTile } from './ShiftInfoTile';
import './ShiftDrawers.css';

interface ShiftReportDrawerProps {
  shift: ShiftOverview | null;
  onClose: () => void;
}

// "عرض التقرير": the shift's figures, its submitted report (cash / InstaPay / Vodafone Cash, refunds, net) and the desk activity log,
// downloadable as CSV. Not in the design (smallest sensible drawer).
export function ShiftReportDrawer({ shift, onClose }: ShiftReportDrawerProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${SHIFTS_I18N}.${key}`);
  const toast = useToast();
  const reportId = shift?.report?.report_id ?? null;
  const teamQuery = useShiftTeam(shift?.shift_type ?? null);
  const reportQuery = useShiftReport(reportId);
  const activitiesQuery = useShiftActivities(reportId);
  if (!shift) return null;

  const shiftName = t(`names.${shift.shift_type}`);
  const report = reportQuery.data;
  const team = teamQuery.data ?? [];
  const activities = activitiesQuery.data ?? [];
  const rows: Array<{ label: string; value: string }> = [
    { label: t('tiles.time'), value: formatShiftRange(shift.start_time, shift.end_time, language) },
    { label: t('tiles.runStatus'), value: t(`runStatus.${shift.status}`) },
    { label: t('tiles.employee'), value: shift.staff?.full_name ?? t('noEmployee') },
    { label: t('tiles.team'), value: pluralText(t, 'units.people', shift.team_count, language) },
    { label: t('tiles.rooms'), value: pluralText(t, 'units.rooms', shift.rooms_handled, language) },
    { label: t('tiles.revenue'), value: formatCurrency(shift.gross_revenue, language) },
    { label: t('tiles.cleaning'), value: pluralText(t, 'units.tasks', shift.cleaning_tasks, language) },
    { label: t('tiles.maintenance'), value: pluralText(t, 'units.reports', shift.maintenance_requests, language) },
    { label: t('tiles.pending'), value: formatNumber(shift.pending_items, language) },
    { label: t('handoverStatus'), value: t(handoverKey(shift)) },
  ];
  const reportRows = report ? reportMoneyRows(report, t, language) : [];

  function download() {
    const lines = [
      ...rows, ...reportRows,
      ...team.map((member) => ({ label: t('reportTeamMember'), value: member.staff_name })),
      ...activities.map((item) => ({ label: formatClock(item.timestamp, language), value: item.description })),
    ];
    const done = exportCsv(lines, [
      { header: t('reportField'), value: (line) => line.label },
      { header: t('reportValue'), value: (line) => line.value },
    ], `shift-report-${shift?.shift_type.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
    if (done) toast.notify(t('toastReportDownloaded').replace('{shift}', shiftName), 'success');
  }

  return (
    <Drawer
      open
      eyebrow={t('reportEyebrow')}
      title={t('reportTitle').replace('{shift}', shiftName)}
      closeLabel={t('close')}
      onClose={onClose}
      className="shift-drawer"
      footer={(
        <div className="shift-drawer__footer">
          <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
          <Button onClick={download}>
            <Download aria-hidden="true" />
            {t('downloadReport')}
          </Button>
        </div>
      )}
    >
      <div className="shift-drawer__body">
        <div className="shift-drawer__grid">
          {rows.map((row) => <ShiftInfoTile key={row.label} label={row.label}>{row.value}</ShiftInfoTile>)}
        </div>

        {reportId && (
          <section>
            <h3 className="shift-drawer__heading">{t('reportFinancials')}</h3>
            {reportQuery.isPending ? <p className="shift-drawer__muted">{t('loadingReport')}</p> : (
              <div className="shift-drawer__grid">
                {reportRows.map((row) => <ShiftInfoTile key={row.label} label={row.label}>{row.value}</ShiftInfoTile>)}
              </div>
            )}
          </section>
        )}

        <section>
          <h3 className="shift-drawer__heading">{t('reportTeam')}</h3>
          {teamQuery.isPending ? (
            <p className="shift-drawer__muted">{t('loadingTeam')}</p>
          ) : team.length === 0 ? (
            <p className="shift-drawer__muted">{t('teamEmpty')}</p>
          ) : (
            <ul className="shift-drawer__team">
              {team.map((member) => (
                <li key={member.shift_id}>
                  <span>{member.staff_name}</span>
                  <small>{t(`runStatus.${member.status}`)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {reportId && (
          <section>
            <h3 className="shift-drawer__heading">{t('activitiesTitle')}</h3>
            {activities.length === 0 ? <p className="shift-drawer__muted">{t('activitiesEmpty')}</p> : (
              <ul className="shift-drawer__team">
                {activities.map((item) => (
                  <li key={item.activity_id}>
                    <span dir="auto">{item.description}</span>
                    <small>{item.amount !== undefined ? `${formatCurrency(item.amount, language)} · ` : ''}{formatClock(item.timestamp, language)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Drawer>
  );
}
