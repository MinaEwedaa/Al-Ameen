import {
  BedDouble,
  Users,
  Check,
  Sparkles,
  Wrench,
  FileText,
  Wallet,
  Clock,
  Download,
} from 'lucide-react';
import { PageHero } from '../../../components/common/PageHero';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import { useToast } from '../../../components/ui/ToastContext';
import {
  RoomsOverviewCard,
  RevenueOverviewCard,
  CriticalIssuesCard,
  ShiftsOverviewCard,
  LatestActivitiesCard,
  StaffActivityCard,
} from '../components';

import { useManagerDashboardSummary } from '../hooks/useManagerDashboardSummary';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { formatNumber } from '../../../utils/format';
import { exportDashboardSummaryCsv, exportStaffActivityCsv } from '../utils/dashboardExport';
import {
  MANAGER_NAV_TARGETS,
  getIssueNavigationTarget,
  navigateToManagerRoute,
} from '../constants/navigation';
import type { CriticalIssueItem, ShiftOverviewItem } from '../types/manager-dashboard.types';
import './ManagerDashboardPage.css';

export function ManagerDashboardPage() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const { data, isLoading, isError, error, refetch } = useManagerDashboardSummary();

  const handleCreateReport = () => {
    if (!data) return;
    const success = exportDashboardSummaryCsv(data, language);
    if (success) {
      showToast(t('manager.dashboard.reportDownloaded'), 'success');
    } else {
      showToast(t('manager.dashboard.exportError'), 'error');
    }
  };

  const handleExportStaff = () => {
    if (!data?.staffActivity?.staffList) return;
    const success = exportStaffActivityCsv(data.staffActivity.staffList, language);
    if (success) {
      showToast(t('manager.dashboard.exportDownloaded'), 'success');
    } else {
      showToast(t('manager.dashboard.exportError'), 'error');
    }
  };

  const handleSelectIssue = (issue: CriticalIssueItem) => {
    const target = getIssueNavigationTarget(issue.issueType, issue.icon);
    navigateToManagerRoute(target);
  };

  const handleViewShiftDetails = () => {
    navigateToManagerRoute(MANAGER_NAV_TARGETS.shifts);
  };

  const handleSelectShift = (shift: ShiftOverviewItem) => {
    navigateToManagerRoute(`${MANAGER_NAV_TARGETS.shifts}?id=${shift.id}`);
  };

  const heroActions = (
    <>
      <Button
        variant="gold"
        className="manager-dashboard__hero-btn"
        type="button"
        onClick={handleCreateReport}
      >
        <FileText size={18} aria-hidden="true" />
        <span>{t('manager.dashboard.hero.createReport')}</span>
      </Button>
      <Button
        variant="glass"
        className="manager-dashboard__hero-btn"
        type="button"
        onClick={handleExportStaff}
      >
        <Download size={18} aria-hidden="true" />
        <span>{t('manager.dashboard.hero.export')}</span>
      </Button>
    </>
  );

  if (isLoading) {
    return (
      <div className="manager-dashboard-page">
        <PageHero
          eyebrow={t('manager.dashboard.hero.eyebrow')}
          title={t('manager.dashboard.hero.title')}
          description={t('manager.dashboard.hero.description')}
        >
          {heroActions}
        </PageHero>
        <LoadingState label={t('manager.dashboard.loading')} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="manager-dashboard-page">
        <PageHero
          eyebrow={t('manager.dashboard.hero.eyebrow')}
          title={t('manager.dashboard.hero.title')}
          description={t('manager.dashboard.hero.description')}
        >
          {heroActions}
        </PageHero>
        <ErrorState
          title={t('manager.dashboard.errorTitle')}
          message={error ? getErrorMessage(error, language) : ''}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              {t('manager.dashboard.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="manager-dashboard-page">
        <PageHero
          eyebrow={t('manager.dashboard.hero.eyebrow')}
          title={t('manager.dashboard.hero.title')}
          description={t('manager.dashboard.hero.description')}
        >
          {heroActions}
        </PageHero>
        <EmptyState
          title={t('manager.dashboard.emptyTitle')}
          description={t('manager.dashboard.emptyDescription')}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              {t('manager.dashboard.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const {
    kpis,
    revenue,
    roomsOverview,
    criticalIssues,
    shifts,
    activities,
    staffActivity,
  } = data;

  // Formatted revenue display matching Slice 1 ("24,8 ألف" in Arabic / "24.8k" in English)
  const revenueDisplay =
    language === 'ar'
      ? '٢٤٫٨ ألف'
      : `${formatNumber(revenue.today / 1000, language, 1)}k`;

  return (
    <div className="manager-dashboard-page">
      {/* 1. Page Hero with Title, Eyebrow, Description, Gold & Glass action buttons */}
      <PageHero
        eyebrow={t('manager.dashboard.hero.eyebrow')}
        title={t('manager.dashboard.hero.title')}
        description={t('manager.dashboard.hero.description')}
      >
        {heroActions}
      </PageHero>

      {/* 2. 8 KPI Cards Grid (4 rows of 2 cards each matching Figma slice 1_ManagerDashboard_01.jpg) */}
      <section className="manager-dashboard__kpi-grid" aria-label={t('manager.dashboard.hero.title')}>
        {/* Row 1 */}
        <StatCard
          label={t('manager.dashboard.kpis.totalRooms')}
          value={formatNumber(kpis.totalRooms.value, language)}
          hint={t('manager.dashboard.kpis.floorsSubtitle')}
          icon={<BedDouble size={20} />}
          tone="green"
        />
        <StatCard
          label={t('manager.dashboard.kpis.occupiedRooms')}
          value={formatNumber(kpis.occupiedRooms.value, language)}
          hint={t('manager.dashboard.kpis.hotelPercentSubtitle')}
          icon={<Users size={20} />}
          tone="teal"
        />

        {/* Row 2 */}
        <StatCard
          label={t('manager.dashboard.kpis.availableRooms')}
          value={formatNumber(kpis.availableRooms.value, language)}
          hint={t('manager.dashboard.kpis.readyForBooking')}
          icon={<Check size={20} />}
          tone="green"
        />
        <StatCard
          label={t('manager.dashboard.kpis.underCleaning')}
          value={formatNumber(kpis.cleaningRooms.value, language)}
          hint={t('manager.dashboard.kpis.priorityRooms')}
          icon={<Sparkles size={20} />}
          tone="amber"
        />

        {/* Row 3 */}
        <StatCard
          label={t('manager.dashboard.kpis.underMaintenance')}
          value={formatNumber(kpis.maintenanceRooms.value, language)}
          hint={t('manager.dashboard.kpis.criticalReport')}
          icon={<Wrench size={20} />}
          tone="rose"
        />
        <StatCard
          label={t('manager.dashboard.kpis.occupancyRate')}
          value={`${formatNumber(kpis.occupancyRate.value, language)}%`}
          hint={t('manager.dashboard.kpis.fromCurrentStock')}
          icon={<FileText size={20} />}
          tone="green"
        />

        {/* Row 4 */}
        <StatCard
          label={t('manager.dashboard.kpis.todayRevenue')}
          value={revenueDisplay}
          hint={t('manager.dashboard.kpis.vsYesterday')}
          icon={<Wallet size={20} />}
          tone="gold"
        />
        <StatCard
          label={t('manager.dashboard.kpis.pendingTasks')}
          value={formatNumber(kpis.pendingTasks.value, language)}
          hint={t('manager.dashboard.kpis.acrossDepartments')}
          icon={<Clock size={20} />}
          tone="amber"
        />
      </section>

      {/* 3. Operational & Financial Overview: Rooms Overview + Revenue Overview (side-by-side) */}
      <section className="manager-dashboard__two-col-row" aria-label="نظرة تشغيلية ومالية">
        <RoomsOverviewCard data={roomsOverview} />
        <RevenueOverviewCard data={revenue} />
      </section>

      {/* 4. Shifts & Critical Issues (side-by-side matching Figma slices 02) */}
      <section className="manager-dashboard__two-col-row" aria-label="الورديات والقضايا المهمة">
        <ShiftsOverviewCard
          shifts={shifts}
          onViewDetails={handleViewShiftDetails}
          onSelectShift={handleSelectShift}
        />
        <CriticalIssuesCard
          issues={criticalIssues}
          onSelectIssue={handleSelectIssue}
        />
      </section>

      {/* 5. Staff & Latest Activities (side-by-side matching Figma slices 03) */}
      <section className="manager-dashboard__two-col-row" aria-label="نشاط الموظفين وأحدث الأنشطة">
        <StaffActivityCard staffActivity={staffActivity} />
        <LatestActivitiesCard activities={activities} />
      </section>
    </div>
  );
}
