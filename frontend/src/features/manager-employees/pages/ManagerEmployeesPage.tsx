import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, FileText, LogIn, Plus, ReceiptText, Sparkles, User, Wrench } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { FilterBar } from '../../../components/common/FilterBar';
import { LoadingState } from '../../../components/common/LoadingState';
import { PageHero } from '../../../components/common/PageHero';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { StatCard } from '../../../components/ui/StatCard';
import { useToast } from '../../../components/ui/ToastContext';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { useDebounce } from '../../../hooks/useDebounce';
import { exportCsv } from '../../../utils/exportCsv';
import { formatNumber } from '../../../utils/format';
import { EmployeeDetailsDrawer } from '../components/EmployeeDetailsDrawer';
import { EmployeeFormDrawer } from '../components/EmployeeFormDrawer';
import { EmployeesTable } from '../components/EmployeesTable';
import { ShiftCoverageCard } from '../components/ShiftCoverageCard';
import { TemporaryPasswordDialog } from '../components/TemporaryPasswordDialog';
import {
  EMPLOYEES_I18N,
  EMPLOYEES_PAGE_SIZE,
  MANAGER_SHIFTS_ASSIGN_PATH,
  NO_SHIFT,
  SHIFT_OPTIONS,
  STAFF_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '../constants/employees.constants';
import {
  useCreateStaff,
  useResetStaffPassword,
  useSetStaffActive,
  useShiftCoverage,
  useStaff,
  useUpdateStaff,
} from '../hooks/useEmployees';
import type {
  EmployeeFilterName,
  EmployeeFilters,
  ShiftType,
  Staff,
  StaffCreate,
  StaffUpdate,
} from '../types/employee.types';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { apiErrorText, conflictField } from '../utils/apiErrorText';
import {
  employeeStatus,
  formatDay,
  formatLastLogin,
  isWorkingNow,
  normalizeSearch,
  pluralText,
} from '../utils/employeeDisplay';
import './ManagerEmployeesPage.css';

// URL params: q, role, shift, status, page — plus id (details drawer), mode=edit and employee=new (add drawer)
function parseFilters(params: URLSearchParams): EmployeeFilters {
  const role = params.get('role') ?? '';
  const shift = params.get('shift') ?? '';
  const status = params.get('status') ?? '';
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: params.get('q') ?? '',
    role: (STAFF_TYPE_OPTIONS as string[]).includes(role) ? role as EmployeeFilters['role'] : '',
    shift: ([...SHIFT_OPTIONS, NO_SHIFT] as string[]).includes(shift) ? shift as EmployeeFilters['shift'] : '',
    status: (STATUS_OPTIONS as string[]).includes(status) ? status as EmployeeFilters['status'] : '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function matchesFilters(member: Staff, filters: EmployeeFilters): boolean {
  const search = normalizeSearch(filters.q);
  const matchesQuery = !search
    || normalizeSearch(member.full_name).includes(search)
    || member.email.includes(search)
    || member.phone.replace('+20', '0').includes(search)
    || member.phone.includes(search);
  const matchesRole = !filters.role || member.staff_type === filters.role;
  const shiftType = member.today_shift?.shift_type ?? NO_SHIFT;
  const matchesShift = !filters.shift || shiftType === filters.shift;
  const matchesStatus = !filters.status || employeeStatus(member) === filters.status;
  return matchesQuery && matchesRole && matchesShift && matchesStatus;
}

interface PasswordNotice {
  name: string;
  password: string;
  reason: 'created' | 'reset';
}

export function ManagerEmployeesPage() {
  const { language, t: translate } = useLanguage();
  const t = useCallback((key: string) => translate(`${EMPLOYEES_I18N}.${key}`), [translate]);
  const toast = useToast();
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const debouncedSearch = useDebounce(searchDraft, 300);
  const [passwordNotice, setPasswordNotice] = useState<PasswordNotice | null>(null);
  // One key per opening of the add drawer, so a retry after a network error is not a second account
  const [createKey, setCreateKey] = useState(newIdempotencyKey);

  const staffQuery = useStaff();
  const coverageQuery = useShiftCoverage();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const setStaffActive = useSetStaffActive();
  const resetPassword = useResetStaffPassword();
  const employees = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const coverage = useMemo(() => coverageQuery.data ?? [], [coverageQuery.data]);

  const selectedId = searchParams.get('id');
  const selectedEmployee = employees.find((member) => member.staff_id === selectedId) ?? null;
  const detailsMode = searchParams.get('mode') === 'edit' ? 'edit' : 'view';
  const isAddOpen = searchParams.get('employee') === 'new';

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

  const filteredEmployees = useMemo(
    () => employees.filter((member) => matchesFilters(member, filters)),
    [employees, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / EMPLOYEES_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageEmployees = filteredEmployees.slice((page - 1) * EMPLOYEES_PAGE_SIZE, page * EMPLOYEES_PAGE_SIZE);

  const stats = useMemo(() => {
    const active = employees.filter((member) => member.is_active);
    const byType = (type: Staff['staff_type']) => active.filter((member) => member.staff_type === type);
    const housekeeping = byType('HOUSEKEEPER');
    const maintenance = byType('TECHNICIAN');
    return {
      total: active.length,
      reception: byType('RECEPTIONIST').length,
      receptionUncovered: coverage.filter((shift) => !shift.staff).length,
      housekeeping: housekeeping.length,
      housekeepingWorking: housekeeping.filter(isWorkingNow).length,
      maintenance: maintenance.length,
      maintenanceAvailable: maintenance.filter(isWorkingNow).length,
      working: active.filter(isWorkingNow).length,
      offShift: active.filter((member) => !isWorkingNow(member)).length,
      noShift: active.filter((member) => !member.today_shift).length,
    };
  }, [coverage, employees]);

  const activeShift = coverage.find((shift) => shift.status === 'ACTIVE');
  const count = (value: number) => formatNumber(value, language);

  function receptionHint() {
    if (coverage.length === 0) return undefined;
    if (stats.receptionUncovered === 0) return t('stats.receptionCovered');
    if (stats.receptionUncovered === 1) return t('stats.receptionGapOne');
    return t('stats.receptionGap').replace('{count}', count(stats.receptionUncovered));
  }

  function changeFilter(name: EmployeeFilterName, value: string) {
    updateParams({ [name]: value, page: null });
  }

  function resetFilters() {
    setSearchDraft('');
    updateParams({ q: null, role: null, shift: null, status: null, page: null });
  }

  function changePage(nextPage: number) {
    updateParams({ page: nextPage > 1 ? String(nextPage) : null });
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const openEmployee = (id: string) => updateParams({ id, mode: null, employee: null });
  const openAdd = () => {
    setCreateKey(newIdempotencyKey());
    updateParams({ employee: 'new', id: null, mode: null });
  };
  const closeDrawers = () => updateParams({ id: null, mode: null, employee: null });

  async function submitEmployee(body: StaffCreate, shift: ShiftType | null) {
    try {
      const { created, shiftError } = await createStaff.mutateAsync({ body, shift, idempotencyKey: createKey });
      closeDrawers();
      toast.notify(t('toastCreated').replace('{name}', created.full_name), 'success');
      if (shiftError) toast.notify(t('toastShiftNotSet').replace('{reason}', apiErrorText(shiftError, t, language)), 'warning');
      setPasswordNotice({ name: created.full_name, password: created.temporary_password, reason: 'created' });
      return null;
    } catch (error) {
      const field = conflictField(error);
      if (!field) toast.notify(apiErrorText(error, t, language), 'error');
      return field;
    }
  }

  async function saveEmployee(body: StaffUpdate) {
    if (!selectedEmployee) return null;
    try {
      const saved = await updateStaff.mutateAsync({ staffId: selectedEmployee.staff_id, body });
      updateParams({ mode: null });
      toast.notify(t('toastUpdated').replace('{name}', saved.full_name), 'success');
      return null;
    } catch (error) {
      const field = conflictField(error);
      if (!field) toast.notify(apiErrorText(error, t, language), 'error');
      return field;
    }
  }

  async function resetEmployeePassword() {
    if (!selectedEmployee) return false;
    try {
      const password = await resetPassword.mutateAsync(selectedEmployee.staff_id);
      setPasswordNotice({ name: selectedEmployee.full_name, password, reason: 'reset' });
      return true;
    } catch (error) {
      toast.notify(apiErrorText(error, t, language), 'error');
      return false;
    }
  }

  async function setEmployeeActive(active: boolean) {
    if (!selectedEmployee) return false;
    try {
      await setStaffActive.mutateAsync({ staffId: selectedEmployee.staff_id, active });
      toast.notify(t(active ? 'toastReactivated' : 'toastDeactivated').replace('{name}', selectedEmployee.full_name), 'success');
      return true;
    } catch (error) {
      toast.notify(apiErrorText(error, t, language), 'error');
      return false;
    }
  }

  function exportEmployees() {
    if (filteredEmployees.length === 0) {
      toast.notify(t('toastNothingToExport'), 'warning');
      return;
    }
    const exported = exportCsv<Staff>(filteredEmployees, [
      { header: t('colEmployee'), value: (member) => member.full_name },
      { header: t('colRole'), value: (member) => t(`roles.${member.staff_type}`) },
      { header: t('colShift'), value: (member) => t(`shifts.${member.today_shift?.shift_type ?? NO_SHIFT}`) },
      { header: t('fields.phone'), value: (member) => member.phone },
      { header: t('fields.email'), value: (member) => member.email },
      { header: t('fields.hireDate'), value: (member) => formatDay(member.hire_date, language) },
      { header: t('colTasks'), value: (member) => member.workload?.assigned_today ?? 0 },
      { header: t('colCompleted'), value: (member) => member.workload?.completed_today ?? 0 },
      { header: t('colPending'), value: (member) => member.workload?.open ?? 0 },
      { header: t('colStatus'), value: (member) => t(`statuses.${employeeStatus(member)}`) },
      { header: t('tileLastLogin'), value: (member) => formatLastLogin(member.last_login_at, language) },
    ], `employees-${new Date().toISOString().slice(0, 10)}.csv`);
    if (exported) toast.notify(pluralText(t, 'toastExported', filteredEmployees.length, language), 'success');
  }

  const hero = (withActions: boolean) => (
    <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('description')}>
      {withActions && (
        <>
          <Button variant="glass" onClick={exportEmployees}>
            <FileText aria-hidden="true" />
            {t('export')}
          </Button>
          <Button variant="gold" onClick={openAdd}>
            <Plus aria-hidden="true" />
            {t('addEmployee')}
          </Button>
        </>
      )}
    </PageHero>
  );

  if (staffQuery.isPending) {
    return <div className="feature-page manager-employees">{hero(false)}<LoadingState label={t('loading')} /></div>;
  }

  if (staffQuery.isError) {
    return (
      <div className="feature-page manager-employees">
        {hero(false)}
        <ErrorState
          title={t('loadError')}
          message={apiErrorText(staffQuery.error, t, language)}
          action={<Button onClick={() => { void staffQuery.refetch(); }}>{t('retry')}</Button>}
        />
      </div>
    );
  }

  const hasFilters = Boolean(filters.q || filters.role || filters.shift || filters.status);

  return (
    <div className="feature-page manager-employees">
      {hero(true)}

      {/* Same order as the design: in Arabic the maintenance card sits on the right */}
      <div className="stat-grid manager-employees__stats">
        <StatCard label={t('stats.maintenance')} value={stats.maintenance} icon={<Wrench size={20} aria-hidden="true" />} tone="gold"
          hint={t('stats.maintenanceHint').replace('{count}', count(stats.maintenanceAvailable))} />
        <StatCard label={t('stats.housekeeping')} value={stats.housekeeping} icon={<Sparkles size={20} aria-hidden="true" />} tone="green"
          hint={t('stats.housekeepingHint').replace('{count}', count(stats.housekeepingWorking))} />
        <StatCard label={t('stats.reception')} value={stats.reception} icon={<User size={20} aria-hidden="true" />} tone="green"
          hint={receptionHint()} />
        <StatCard label={t('stats.total')} value={stats.total} icon={<User size={20} aria-hidden="true" />} tone="green"
          hint={t('stats.totalHint')} />
        <StatCard label={t('stats.pendingAssignments')} value={stats.noShift} icon={<ReceiptText size={20} aria-hidden="true" />} tone="gold" className="manager-employees__stat--pending"
          hint={stats.noShift > 0 ? t('stats.pendingHint') : t('stats.pendingNone')} />
        <StatCard label={t('stats.offShift')} value={stats.offShift} icon={<LogIn size={20} aria-hidden="true" />} tone="gold"
          hint={t('stats.offShiftHint')} />
        <StatCard label={t('stats.working')} value={stats.working} icon={<Clock size={20} aria-hidden="true" />} tone="green"
          hint={activeShift ? t(`stats.workingHint.${activeShift.shift_type}`) : undefined} />
      </div>

      {coverageQuery.isError ? (
        <ErrorState
          title={t('coverageError')}
          message={apiErrorText(coverageQuery.error, t, language)}
          action={<Button variant="secondary" onClick={() => { void coverageQuery.refetch(); }}>{t('retry')}</Button>}
        />
      ) : (
        <ShiftCoverageCard shifts={coverage} onManage={() => navigate(MANAGER_SHIFTS_ASSIGN_PATH)} />
      )}

      <Card className="filters-card">
        <FilterBar
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder={t('searchPlaceholder')}
          columns={4}
          onReset={resetFilters}
          resetLabel={t('reset')}
        >
          <Select
            value={filters.role}
            label={t('filterRole')}
            placeholder={t('allRoles')}
            options={[{ value: '', label: t('allRoles') }, ...STAFF_TYPE_OPTIONS.map((type) => ({ value: type, label: t(`roles.${type}`) }))]}
            onChange={(value) => changeFilter('role', value)}
          />
          <Select
            value={filters.shift}
            label={t('filterShift')}
            placeholder={t('allShifts')}
            options={[
              { value: '', label: t('allShifts') },
              ...SHIFT_OPTIONS.map((shift) => ({ value: shift, label: t(`shifts.${shift}`) })),
              { value: NO_SHIFT, label: t('shifts.NONE') },
            ]}
            onChange={(value) => changeFilter('shift', value)}
          />
          <Select
            value={filters.status}
            label={t('filterStatus')}
            placeholder={t('allStatuses')}
            options={[{ value: '', label: t('allStatuses') }, ...STATUS_OPTIONS.map((status) => ({ value: status, label: t(`statuses.${status}`) }))]}
            onChange={(value) => changeFilter('status', value)}
          />
        </FilterBar>
      </Card>

      {filteredEmployees.length === 0 ? (
        <EmptyState
          title={hasFilters ? t('emptyTitle') : t('emptyNoEmployees')}
          description={hasFilters ? t('emptyDescription') : t('emptyNoEmployeesHint')}
          action={hasFilters
            ? <Button variant="secondary" onClick={resetFilters}>{t('reset')}</Button>
            : <Button onClick={openAdd}>{t('addEmployee')}</Button>}
        />
      ) : (
        <div ref={tableRef}>
          <EmployeesTable
            employees={pageEmployees}
            totalEmployees={filteredEmployees.length}
            page={page}
            totalPages={totalPages}
            onPageChange={changePage}
            onOpen={openEmployee}
          />
        </div>
      )}

      <EmployeeDetailsDrawer
        employee={selectedEmployee}
        employees={employees}
        mode={detailsMode}
        isSaving={updateStaff.isPending}
        isActing={setStaffActive.isPending || resetPassword.isPending}
        onClose={closeDrawers}
        onEdit={() => updateParams({ mode: 'edit' })}
        onCancelEdit={() => updateParams({ mode: null })}
        onSave={saveEmployee}
        onResetPassword={resetEmployeePassword}
        onSetActive={setEmployeeActive}
      />
      <EmployeeFormDrawer
        key={isAddOpen ? `add-${createKey}` : 'add-closed'}
        open={isAddOpen}
        employees={employees}
        isSaving={createStaff.isPending}
        onClose={closeDrawers}
        onSubmit={submitEmployee}
      />
      {passwordNotice && (
        <TemporaryPasswordDialog
          name={passwordNotice.name}
          password={passwordNotice.password}
          reason={passwordNotice.reason}
          onClose={() => setPasswordNotice(null)}
        />
      )}
    </div>
  );
}
