import { useCallback, useMemo } from 'react';
import { FileText, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { PageHero } from '../../../components/common/PageHero';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/ToastContext';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { exportCsv } from '../../../utils/exportCsv';
import { AssignmentsDrawer } from '../components/AssignmentsDrawer';
import { HandoverReviewDrawer } from '../components/HandoverReviewDrawer';
import { HandoversTable } from '../components/HandoversTable';
import { ShiftCard } from '../components/ShiftCard';
import { ShiftDetailsDrawer } from '../components/ShiftDetailsDrawer';
import { ShiftReportDrawer } from '../components/ShiftReportDrawer';
import {
  DRAWER_PARAMS,
  PARAM_ASSIGN,
  PARAM_DETAILS,
  PARAM_REPORT,
  PARAM_REVIEW,
  SHIFT_ORDER,
  SHIFTS_I18N,
} from '../constants/shifts.constants';
import {
  useAssignees,
  useAssignShift,
  useCancelShift,
  useReviewReport,
  useShiftReports,
  useShiftsOverview,
} from '../hooks/useShifts';
import type { Assignee, ShiftEntry, ShiftOverview, ShiftType } from '../types/shift.types';
import { apiErrorText, formatShiftRange, handoverKey } from '../utils/shiftDisplay';
import './ManagerShiftsPage.css';

// URL params: assign=1 (assignments), report=<SHIFT_TYPE> (report drawer), details=<SHIFT_TYPE> (team drawer),
// review=<report_id> (handover review drawer)
export function ManagerShiftsPage() {
  const { language, t: translate } = useLanguage();
  const t = useCallback((key: string) => translate(`${SHIFTS_I18N}.${key}`), [translate]);
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const overviewQuery = useShiftsOverview();
  const reportsQuery = useShiftReports();
  const reviewReport = useReviewReport();
  const assignShift = useAssignShift();
  const cancelShift = useCancelShift();

  const isAssignOpen = searchParams.get(PARAM_ASSIGN) === '1';
  const reportType = searchParams.get(PARAM_REPORT);
  const detailsType = searchParams.get(PARAM_DETAILS);
  const reviewId = searchParams.get(PARAM_REVIEW) || null;
  const assigneesQuery = useAssignees(isAssignOpen);

  const shifts = useMemo(
    () => [...(overviewQuery.data ?? [])].sort((a, b) => SHIFT_ORDER.indexOf(a.shift_type) - SHIFT_ORDER.indexOf(b.shift_type)),
    [overviewQuery.data],
  );
  const reports = useMemo(
    () => [...(reportsQuery.data ?? [])].sort((a, b) => b.business_date.localeCompare(a.business_date)
      || SHIFT_ORDER.indexOf(a.shift_type ?? 'MORNING') - SHIFT_ORDER.indexOf(b.shift_type ?? 'MORNING')),
    [reportsQuery.data],
  );
  const findShift = (type: string | null): ShiftOverview | null => shifts.find((shift) => shift.shift_type === type) ?? null;

  const openDrawer = (name: string, value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      DRAWER_PARAMS.forEach((param) => next.delete(param));
      next.set(name, value);
      return next;
    });
  };

  const closeDrawers = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      DRAWER_PARAMS.forEach((param) => next.delete(param));
      return next;
    });
  };

  async function decide(reportId: string, status: 'APPROVED' | 'NEEDS_REVIEW', comment: string) {
    try {
      await reviewReport.mutateAsync({ reportId, status, comment });
      toast.notify(t(status === 'APPROVED' ? 'toastApproved' : 'toastNeedsReview'), 'success');
      return true;
    } catch (error) {
      toast.notify(apiErrorText(error, t, language), 'error');
      return false;
    }
  }

  async function move(assignee: Assignee, shift: ShiftType) {
    try {
      await assignShift.mutateAsync({ assignee, shiftType: shift });
      toast.notify(t('toastMoved').replace('{name}', assignee.full_name).replace('{shift}', t(`names.${shift}`)), 'success');
      return true;
    } catch (error) {
      toast.notify(apiErrorText(error, t, language), 'error');
      return false;
    }
  }

  async function cancel(entry: ShiftEntry) {
    try {
      await cancelShift.mutateAsync(entry.shift_id);
      toast.notify(t('toastShiftCancelled').replace('{name}', entry.staff_name), 'success');
      return true;
    } catch (error) {
      toast.notify(apiErrorText(error, t, language), 'error');
      return false;
    }
  }

  function exportShifts() {
    if (shifts.length === 0) {
      toast.notify(t('toastNothingToExport'), 'warning');
      return;
    }
    const done = exportCsv<ShiftOverview>(shifts, [
      { header: t('cols.shift'), value: (shift) => t(`names.${shift.shift_type}`) },
      { header: t('tiles.time'), value: (shift) => formatShiftRange(shift.start_time, shift.end_time, language) },
      { header: t('tiles.runStatus'), value: (shift) => t(`runStatus.${shift.status}`) },
      { header: t('tiles.employee'), value: (shift) => shift.staff?.full_name ?? t('noEmployee') },
      { header: t('tiles.team'), value: (shift) => shift.team_count },
      { header: t('tiles.rooms'), value: (shift) => shift.rooms_handled },
      { header: t('tiles.revenue'), value: (shift) => shift.gross_revenue },
      { header: t('tiles.cleaning'), value: (shift) => shift.cleaning_tasks },
      { header: t('tiles.maintenance'), value: (shift) => shift.maintenance_requests },
      { header: t('tiles.pending'), value: (shift) => shift.pending_items },
      { header: t('handoverStatus'), value: (shift) => t(handoverKey(shift)) },
    ], `shifts-${new Date().toISOString().slice(0, 10)}.csv`);
    if (done) toast.notify(t('toastExported'), 'success');
  }

  const hero = (withActions: boolean) => (
    <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('description')}>
      {withActions && (
        <>
          <Button variant="glass" onClick={exportShifts}>
            <FileText aria-hidden="true" />
            {t('export')}
          </Button>
          <Button variant="gold" onClick={() => openDrawer(PARAM_ASSIGN, '1')}>
            <User aria-hidden="true" />
            {t('manageAssignments')}
          </Button>
        </>
      )}
    </PageHero>
  );

  if (overviewQuery.isPending) {
    return <div className="feature-page manager-shifts">{hero(false)}<LoadingState label={t('loading')} /></div>;
  }

  if (overviewQuery.isError) {
    return (
      <div className="feature-page manager-shifts">
        {hero(false)}
        <ErrorState
          title={t('loadError')}
          message={apiErrorText(overviewQuery.error, t, language)}
          action={<Button onClick={() => { void overviewQuery.refetch(); }}>{t('retry')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="feature-page manager-shifts">
      {hero(true)}

      {shifts.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="manager-shifts__cards">
          {shifts.map((shift) => (
            <ShiftCard
              key={shift.shift_type}
              shift={shift}
              onReport={() => openDrawer(PARAM_REPORT, shift.shift_type)}
              onDetails={() => openDrawer(PARAM_DETAILS, shift.shift_type)}
              onReview={(id) => openDrawer(PARAM_REVIEW, id)}
            />
          ))}
        </div>
      )}

      {reportsQuery.isError ? (
        <ErrorState
          title={t('handoversError')}
          message={apiErrorText(reportsQuery.error, t, language)}
          action={<Button variant="secondary" onClick={() => { void reportsQuery.refetch(); }}>{t('retry')}</Button>}
        />
      ) : reportsQuery.isPending ? (
        <LoadingState label={t('loadingHandovers')} />
      ) : (
        <HandoversTable reports={reports} onOpen={(id) => openDrawer(PARAM_REVIEW, id)} />
      )}

      <ShiftReportDrawer key={`report-${reportType}`} shift={findShift(reportType)} onClose={closeDrawers} />
      <ShiftDetailsDrawer
        key={`details-${detailsType}`}
        shift={findShift(detailsType)}
        isCancelling={cancelShift.isPending}
        onCancelShift={cancel}
        onAssign={() => openDrawer(PARAM_ASSIGN, '1')}
        onClose={closeDrawers}
      />
      <HandoverReviewDrawer
        key={`review-${reviewId}`}
        reportId={reviewId}
        isSaving={reviewReport.isPending}
        onDecide={decide}
        onClose={closeDrawers}
      />
      <AssignmentsDrawer
        key={isAssignOpen ? 'assign-open' : 'assign-closed'}
        open={isAssignOpen}
        assignees={assigneesQuery.data ?? []}
        isLoading={assigneesQuery.isPending}
        error={assigneesQuery.isError ? assigneesQuery.error : null}
        onRetry={() => { void assigneesQuery.refetch(); }}
        isSaving={assignShift.isPending}
        onClose={closeDrawers}
        onMove={move}
      />
    </div>
  );
}
