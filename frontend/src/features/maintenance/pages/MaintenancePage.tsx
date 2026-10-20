import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, Clock, FileText, Plus, Timer, Wrench } from 'lucide-react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { PageHero } from '../../../components/common/PageHero';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { useToast } from '../../../components/ui/ToastContext';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { getTranslation, type Language } from '../../../core/i18n';
import { useDebounce } from '../../../hooks/useDebounce';
import { normalizeDigits } from '../../../utils/digits';
import { exportCsv } from '../../../utils/exportCsv';
import { formatNumber } from '../../../utils/format';
import { MaintenanceDetailsDrawer } from '../components/MaintenanceDetailsDrawer';
import { MaintenanceFilters } from '../components/MaintenanceFilters';
import { MaintenanceFormDrawer } from '../components/MaintenanceFormDrawer';
import { MaintenanceTable } from '../components/MaintenanceTable';
import {
  MT_PAGE_SIZE,
  PRIORITY_LABEL_KEY,
  PRIORITY_OPTIONS,
  STATUS_LABEL_KEY,
  STATUS_OPTIONS,
} from '../constants/maintenance.constants';
import {
  useCreateMaintenanceRequest,
  useMaintenanceRequests,
  useRoomNumbers,
  useUpdateMaintenanceStatus,
} from '../hooks/useMaintenanceRequests';
import type {
  MaintenanceFilterName,
  MaintenanceFilters as Filters,
  MaintenanceIssueCreate,
  MaintenanceIssueStatus,
  MaintenanceIssueUpdate,
  MaintenanceRequest,
  Priority,
} from '../types/maintenance.types';
import {
  averageResolutionMinutes,
  formatReference,
  formatRequestTime,
  formatTimeAgo,
  isToday,
  lastUpdateOf,
} from '../utils/maintenanceDisplay';
import './MaintenancePage.css';

// URL params: q, room, priority, status, page — plus id (details drawer) and request=new (form drawer)
function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status') ?? '';
  const priority = params.get('priority') ?? '';
  const room = params.get('room') ?? '';
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: params.get('q') ?? '',
    room: /^\d+$/.test(room) ? room : '',
    priority: PRIORITY_OPTIONS.includes(priority as Priority) ? priority as Priority : '',
    status: STATUS_OPTIONS.includes(status as MaintenanceIssueStatus) ? status as MaintenanceIssueStatus : '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function MaintenancePage() {
  const { language } = useOutletContext<{ language: Language }>();
  const t = (key: string) => getTranslation(language, key);
  const toast = useToast();
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const debouncedSearch = useDebounce(searchDraft, 300);

  const requestsQuery = useMaintenanceRequests();
  const createRequest = useCreateMaintenanceRequest();
  const updateStatus = useUpdateMaintenanceStatus();
  const roomsQuery = useRoomNumbers();
  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);

  const selectedId = searchParams.get('id');
  const selectedRequest = requests.find((request) => String(request.issue_id) === selectedId) ?? null;
  const isFormOpen = searchParams.get('request') === 'new';

  const updateParams = useCallback((changes: Record<string, string | null>, replace = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [name, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(name);
        else next.set(name, value);
      }
      return next;
    }, { replace });
  }, [setSearchParams]);

  // Keep the search box in sync when the URL changes (back button, reset)
  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  // Write the search to the URL 300ms after the user stops typing
  useEffect(() => {
    if (debouncedSearch === filters.q || searchDraft !== debouncedSearch) return;
    updateParams({ q: debouncedSearch.trim(), page: null }, true);
  }, [debouncedSearch, filters.q, searchDraft, updateParams]);

  const roomOptions = useMemo(
    () => Array.from(new Set(requests.map((request) => request.room_number || String(request.room_id)))).sort((a, b) => Number(a) - Number(b)),
    [requests],
  );

  // Search by room number or issue description, as the search placeholder says
  const filteredRequests = useMemo(() => {
    const search = normalizeDigits(filters.q.trim()).toLocaleLowerCase();
    return requests.filter((request) => {
      const roomNum = String(request.room_number || request.room_id);
      const matchesQuery = !search
        || roomNum.includes(search)
        || request.problem.toLocaleLowerCase().includes(search);
      const matchesRoom = !filters.room || roomNum === filters.room;
      const matchesPriority = !filters.priority || request.priority === filters.priority;
      const matchesStatus = !filters.status || request.status === filters.status;
      return matchesQuery && matchesRoom && matchesPriority && matchesStatus;
    });
  }, [filters, requests]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / MT_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageRequests = filteredRequests.slice((page - 1) * MT_PAGE_SIZE, page * MT_PAGE_SIZE);

  const averageMinutes = averageResolutionMinutes(requests);
  const stats = {
    total: requests.length,
    urgent: requests.filter((request) => request.priority === 'urgent').length,
    open: requests.filter((request) => request.status === 'open').length,
    resolved: requests.filter((request) => request.status === 'resolved').length,
    today: requests.filter((request) => isToday(request.created_date)).length,
    average: averageMinutes === null ? '—' : t('mtDurationMinutes').replace('{n}', formatNumber(averageMinutes, language)),
  };

  function changeFilter(name: MaintenanceFilterName, value: string) {
    updateParams({ [name]: value, page: null });
  }

  function resetFilters() {
    setSearchDraft('');
    updateParams({ q: null, room: null, priority: null, status: null, page: null });
  }

  function changePage(nextPage: number) {
    updateParams({ page: nextPage > 1 ? String(nextPage) : null });
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const openRequest = (issueId: string | number) => updateParams({ id: String(issueId), request: null });
  const openForm = () => updateParams({ request: 'new', id: null });
  const closeDrawers = () => updateParams({ id: null, request: null });

  async function submitRequest(body: MaintenanceIssueCreate) {
    try {
      await createRequest.mutateAsync(body);
      closeDrawers();
      toast.notify(t('mtToastCreated'), 'success');
    } catch (error) {
      toast.notify(getErrorMessage(error, language), 'error');
    }
  }

  async function saveStatus(status: NonNullable<MaintenanceIssueUpdate['status']>) {
    if (!selectedRequest) return;
    try {
      await updateStatus.mutateAsync({ issueId: selectedRequest.issue_id, status });
      closeDrawers();
      toast.notify(t('mtToastUpdated'), 'success');
    } catch (error) {
      toast.notify(getErrorMessage(error, language), 'error');
    }
  }

  function exportRequests() {
    if (filteredRequests.length === 0) {
      toast.notify(t('mtToastNoExport'), 'warning');
      return;
    }
    const exported = exportCsv<MaintenanceRequest>(filteredRequests, [
      { header: t('mtColReference'), value: (request) => formatReference(request.issue_id, 'en') },
      { header: t('colRoom'), value: (request) => request.room_number || request.room_id },
      { header: t('mtColIssue'), value: (request) => request.problem },
      { header: t('priorityLabel'), value: (request) => t(PRIORITY_LABEL_KEY[request.priority]) },
      { header: t('statusLabel'), value: (request) => t(STATUS_LABEL_KEY[request.status]) },
      { header: t('mtColReportedAt'), value: (request) => formatRequestTime(request.created_date, language) },
      { header: t('mtColLastUpdate'), value: (request) => formatTimeAgo(lastUpdateOf(request), language) },
      { header: t('mtDescription'), value: (request) => request.notes ?? '' },
    ], `maintenance-${new Date().toISOString().slice(0, 10)}.csv`);
    if (exported) {
      toast.notify(t('mtToastExported').replace('{count}', formatNumber(filteredRequests.length, language)), 'success');
    }
  }

  const hero = (actions?: boolean) => (
    <PageHero eyebrow={t('maintenance')} title={t('mtHeroTitle')} description={t('mtHeroDesc')}>
      {actions && (
        <>
          <Button variant="glass" className="maintenance-page__hero-export" onClick={exportRequests}>
            <FileText aria-hidden="true" />
            {t('export')}
          </Button>
          <Button variant="gold" className="maintenance-page__hero-add" onClick={openForm}>
            <Plus aria-hidden="true" />
            {t('mtNewRequest')}
          </Button>
        </>
      )}
    </PageHero>
  );

  if (requestsQuery.isPending) {
    return <div className="feature-page maintenance-page">{hero()}<LoadingState label={t('mtLoading')} /></div>;
  }

  if (requestsQuery.isError) {
    return (
      <div className="feature-page maintenance-page">
        {hero()}
        <ErrorState
          title={t('mtLoadError')}
          message={getErrorMessage(requestsQuery.error, language)}
          action={<Button onClick={() => { void requestsQuery.refetch(); }}>{t('mtRetry')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="feature-page maintenance-page">
      {hero(true)}

      <div className="stat-grid maintenance-page__stats">
        <StatCard label={t('mtStatTotal')} value={stats.total} icon={<Wrench size={20} aria-hidden="true" />} tone="amber" />
        <StatCard label={t('mtStatCritical')} value={stats.urgent} icon={<Bell size={20} aria-hidden="true" />} tone="amber" />
        <StatCard label={t('mtStatPending')} value={stats.open} icon={<Clock size={20} aria-hidden="true" />} tone="amber" />
        <StatCard label={t('mtStatResolved')} value={stats.resolved} icon={<Check size={20} aria-hidden="true" />} tone="teal" />
        <StatCard label={t('mtStatToday')} value={stats.today} icon={<CalendarDays size={20} aria-hidden="true" />} tone="teal" />
        <StatCard label={t('mtStatAverage')} value={stats.average} icon={<Timer size={20} aria-hidden="true" />} tone="amber" />
      </div>

      <Card className="filters-card">
        <MaintenanceFilters
          language={language}
          value={searchDraft}
          onSearchChange={setSearchDraft}
          filters={filters}
          roomOptions={roomOptions}
          onFilterChange={changeFilter}
          onReset={resetFilters}
        />
      </Card>

      {filteredRequests.length === 0 ? (
        <EmptyState
          title={t('mtEmpty')}
          description={t('mtEmptyDesc')}
          action={<Button variant="secondary" onClick={resetFilters}>{t('filterReset')}</Button>}
        />
      ) : (
        <div ref={tableRef}>
          <MaintenanceTable
            requests={pageRequests}
            totalRequests={filteredRequests.length}
            language={language}
            page={page}
            totalPages={totalPages}
            onPageChange={changePage}
            onOpenRequest={openRequest}
          />
        </div>
      )}

      <MaintenanceDetailsDrawer
        key={selectedRequest ? `${selectedRequest.issue_id}-${selectedRequest.status}` : 'none'}
        request={selectedRequest}
        language={language}
        onClose={closeDrawers}
        onSave={(status) => { void saveStatus(status); }}
        isSaving={updateStatus.isPending}
      />
      <MaintenanceFormDrawer
        key={isFormOpen ? 'form-open' : 'form-closed'}
        open={isFormOpen}
        language={language}
        onClose={closeDrawers}
        onSubmit={(body) => { void submitRequest(body); }}
        isSaving={createRequest.isPending}
        roomOptions={roomsQuery.data ?? []}
      />
    </div>
  );
}
