import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Clock, FileText, Flag, Plus } from 'lucide-react';
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
import { HousekeepingFilters } from '../components/HousekeepingFilters';
import { HousekeepingTable } from '../components/HousekeepingTable';
import { TaskDetailsDrawer } from '../components/TaskDetailsDrawer';
import { TaskFormDrawer } from '../components/TaskFormDrawer';
import {
  HK_PAGE_SIZE,
  PRIORITY_LABEL_KEY,
  PRIORITY_OPTIONS,
  STATUS_LABEL_KEY,
  STATUS_OPTIONS,
} from '../constants/housekeeping.constants';
import {
  useCompleteHousekeepingTask,
  useCreateHousekeepingTask,
  useHousekeepingTasks,
  useRoomNumbers,
} from '../hooks/useHousekeepingTasks';
import type {
  CleaningTaskCreate,
  CleaningTaskStatus,
  HousekeepingFilterName,
  HousekeepingFilters as Filters,
  HousekeepingTask,
  Priority,
} from '../types/housekeeping.types';
import { formatTaskTime, getFloor, isToday } from '../utils/housekeepingDisplay';
import './HousekeepingPage.css';

// URL params: q, status, priority, floor, page — plus id (details drawer) and task=new (form drawer)
function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status') ?? '';
  const priority = params.get('priority') ?? '';
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: params.get('q') ?? '',
    status: STATUS_OPTIONS.includes(status as CleaningTaskStatus) ? status as CleaningTaskStatus : '',
    priority: PRIORITY_OPTIONS.includes(priority as Priority) ? priority as Priority : '',
    floor: /^\d$/.test(params.get('floor') ?? '') ? params.get('floor') ?? '' : '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function HousekeepingPage() {
  const { language } = useOutletContext<{ language: Language }>();
  const t = (key: string) => getTranslation(language, key);
  const toast = useToast();
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const debouncedSearch = useDebounce(searchDraft, 300);

  const tasksQuery = useHousekeepingTasks();
  const createTask = useCreateHousekeepingTask();
  const completeTask = useCompleteHousekeepingTask();
  const roomsQuery = useRoomNumbers();
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const selectedId = searchParams.get('id');
  const selectedTask = tasks.find((task) => String(task.task_id) === selectedId) ?? null;
  const isFormOpen = searchParams.get('task') === 'new';

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

  const floorOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => getFloor(task.room_number || task.room_id)))).sort(),
    [tasks],
  );

  // Search by room number or cleaner name
  const filteredTasks = useMemo(() => {
    const search = normalizeDigits(filters.q.trim()).toLocaleLowerCase();
    return tasks.filter((task) => {
      const roomNum = String(task.room_number || task.room_id);
      const matchesQuery = !search
        || roomNum.includes(search)
        || (task.cleaner_name ?? '').toLocaleLowerCase().includes(search);
      const matchesStatus = !filters.status || task.status === filters.status;
      const matchesPriority = !filters.priority || task.priority === filters.priority;
      const matchesFloor = !filters.floor || getFloor(task.room_number || task.room_id) === filters.floor;
      return matchesQuery && matchesStatus && matchesPriority && matchesFloor;
    });
  }, [filters, tasks]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / HK_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageTasks = filteredTasks.slice((page - 1) * HK_PAGE_SIZE, page * HK_PAGE_SIZE);

  const stats = {
    today: tasks.filter((task) => isToday(task.assigned_date)).length,
    urgent: tasks.filter((task) => task.priority === 'high' || task.priority === 'urgent').length,
    done: tasks.filter((task) => task.status === 'done').length,
    pending: tasks.filter((task) => task.status === 'pending').length,
  };

  function changeFilter(name: HousekeepingFilterName, value: string) {
    updateParams({ [name]: value, page: null });
  }

  function resetFilters() {
    setSearchDraft('');
    updateParams({ q: null, status: null, priority: null, floor: null, page: null });
  }

  function changePage(nextPage: number) {
    updateParams({ page: nextPage > 1 ? String(nextPage) : null });
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const openTask = (taskId: string | number) => updateParams({ id: String(taskId), task: null });
  const openForm = () => updateParams({ task: 'new', id: null });
  const closeDrawers = () => updateParams({ id: null, task: null });

  async function submitTask(body: CleaningTaskCreate) {
    try {
      await createTask.mutateAsync(body);
      closeDrawers();
      toast.notify(t('hkToastCreated'), 'success');
    } catch (error) {
      toast.notify(getErrorMessage(error, language), 'error');
    }
  }

  async function markDone() {
    if (!selectedTask) return;
    try {
      await completeTask.mutateAsync(selectedTask.task_id);
      closeDrawers();
      toast.notify(t('hkToastDone'), 'success');
    } catch (error) {
      toast.notify(getErrorMessage(error, language), 'error');
    }
  }

  function exportTasks() {
    if (filteredTasks.length === 0) {
      toast.notify(t('hkToastNoExport'), 'warning');
      return;
    }
    const exported = exportCsv<HousekeepingTask>(filteredTasks, [
      { header: t('colRoom'), value: (task) => task.room_number || task.room_id },
      { header: t('hkCleaner'), value: (task) => task.cleaner_name ?? '' },
      { header: t('priorityLabel'), value: (task) => t(PRIORITY_LABEL_KEY[task.priority]) },
      { header: t('statusLabel'), value: (task) => t(STATUS_LABEL_KEY[task.status]) },
      { header: t('hkColCreatedAt'), value: (task) => formatTaskTime(task.assigned_date, language) },
      { header: t('notesLabel'), value: (task) => task.notes ?? '' },
    ], `housekeeping-${new Date().toISOString().slice(0, 10)}.csv`);
    if (exported) {
      toast.notify(t('hkToastExported').replace('{count}', formatNumber(filteredTasks.length, language)), 'success');
    }
  }

  const hero = (actions?: boolean) => (
    <PageHero eyebrow={t('housekeeping')} title={t('hkHeroTitle')} description={t('hkHeroDesc')}>
      {actions && (
        <>
          <Button variant="glass" className="housekeeping-page__hero-export" onClick={exportTasks}>
            <FileText aria-hidden="true" />
            {t('export')}
          </Button>
          <Button variant="gold" className="housekeeping-page__hero-add" onClick={openForm}>
            <Plus aria-hidden="true" />
            {t('hkNewTask')}
          </Button>
        </>
      )}
    </PageHero>
  );

  if (tasksQuery.isPending) {
    return <div className="feature-page housekeeping-page">{hero()}<LoadingState label={t('hkLoading')} /></div>;
  }

  if (tasksQuery.isError) {
    return (
      <div className="feature-page housekeeping-page">
        {hero()}
        <ErrorState
          title={t('hkLoadError')}
          message={getErrorMessage(tasksQuery.error, language)}
          action={<Button onClick={() => { void tasksQuery.refetch(); }}>{t('hkRetry')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="feature-page housekeeping-page">
      {hero(true)}

      <div className="stat-grid housekeeping-page__stats">
        <StatCard label={t('hkStatToday')} value={stats.today} icon={<CalendarDays size={20} aria-hidden="true" />} tone="amber" />
        <StatCard label={t('hkStatHigh')} value={stats.urgent} icon={<Flag size={20} aria-hidden="true" />} tone="rose" />
        <StatCard label={t('hkStatDone')} value={stats.done} icon={<Check size={20} aria-hidden="true" />} tone="teal" />
        <StatCard label={t('hkStatPending')} value={stats.pending} icon={<Clock size={20} aria-hidden="true" />} tone="amber" />
      </div>

      <Card className="filters-card">
        <HousekeepingFilters
          language={language}
          value={searchDraft}
          onSearchChange={setSearchDraft}
          filters={filters}
          floorOptions={floorOptions}
          onFilterChange={changeFilter}
          onReset={resetFilters}
        />
      </Card>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title={t('hkEmpty')}
          description={t('hkEmptyDesc')}
          action={<Button variant="secondary" onClick={resetFilters}>{t('filterReset')}</Button>}
        />
      ) : (
        <div ref={tableRef}>
          <HousekeepingTable
            tasks={pageTasks}
            totalTasks={filteredTasks.length}
            language={language}
            page={page}
            totalPages={totalPages}
            onPageChange={changePage}
            onOpenTask={openTask}
          />
        </div>
      )}

      <TaskDetailsDrawer
        key={selectedTask ? `${selectedTask.task_id}-${selectedTask.status}` : 'none'}
        task={selectedTask}
        language={language}
        onClose={closeDrawers}
        onComplete={() => { void markDone(); }}
        isSaving={completeTask.isPending}
      />
      <TaskFormDrawer
        key={isFormOpen ? 'form-open' : 'form-closed'}
        open={isFormOpen}
        language={language}
        onClose={closeDrawers}
        onSubmit={(body) => { void submitTask(body); }}
        isSaving={createTask.isPending}
        roomOptions={roomsQuery.data ?? []}
      />
    </div>
  );
}