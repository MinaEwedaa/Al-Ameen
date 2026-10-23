import { useState } from 'react';
import { KeyRound, UserCheck, UserX } from 'lucide-react';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { EMPLOYEES_I18N, STATUS_TONE } from '../constants/employees.constants';
import { useEmployeeForm } from '../hooks/useEmployeeForm';
import { toFormValues, toUpdateStaffBody } from '../schemas/employee.schema';
import type { Staff, StaffUpdate } from '../types/employee.types';
import { employeeStatus, formatDay, formatLastLogin, formatMaskedId, formatPhone } from '../utils/employeeDisplay';
import { EmployeeAvatar } from './EmployeeAvatar';
import { EmployeeFormFields } from './EmployeeFormFields';
import { EmployeeInfoTile } from './EmployeeInfoTile';
import './EmployeeDrawers.css';

const FORM_ID = 'manager-employee-edit-form';

interface EmployeeDetailsDrawerProps {
  employee: Staff | null;
  employees: Staff[];
  mode: 'view' | 'edit';
  isSaving: boolean;
  isActing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  /** Resolves to a field name when the server rejects a duplicate */
  onSave: (body: StaffUpdate) => Promise<'email' | 'national_id' | null>;
  onResetPassword: () => Promise<boolean>;
  onSetActive: (active: boolean) => Promise<boolean>;
}

// Employee details (image 3.2). "تعديل البيانات" turns the same drawer into the edit form.
// Account actions (reset password, deactivate / reactivate) come from contract v1.1 (not in the design).
export function EmployeeDetailsDrawer({
  employee, employees, mode, isSaving, isActing, onClose, onEdit, onCancelEdit, onSave, onResetPassword, onSetActive,
}: EmployeeDetailsDrawerProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${EMPLOYEES_I18N}.${key}`);
  const [confirm, setConfirm] = useState<'reset' | 'deactivate' | null>(null);
  if (!employee) return null;

  if (mode === 'edit') {
    return (
      <EditEmployee
        key={employee.staff_id}
        employee={employee}
        others={employees.filter((item) => item.staff_id !== employee.staff_id)}
        isSaving={isSaving}
        onClose={onClose}
        onCancel={onCancelEdit}
        onSave={onSave}
      />
    );
  }

  const status = employeeStatus(employee);
  const shiftLabel = employee.today_shift ? t(`shifts.${employee.today_shift.shift_type}`) : t('shifts.NONE');

  async function runConfirm() {
    const done = confirm === 'reset' ? await onResetPassword() : await onSetActive(false);
    if (done) setConfirm(null);
  }

  return (
    <>
      <Drawer
        open
        eyebrow={t('detailsEyebrow')}
        title={employee.full_name}
        closeLabel={t('close')}
        // Escape while a confirm dialog is open only closes the dialog
        onClose={confirm ? () => setConfirm(null) : onClose}
        className="employee-drawer"
        footer={(
          // A deactivated account can't be edited: the edit button is left out rather than shown disabled
          <div className={`employee-drawer__footer${employee.is_active ? '' : ' employee-drawer__footer--single'}`}>
            <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
            {employee.is_active && <Button onClick={onEdit}>{t('editDetails')}</Button>}
          </div>
        )}
      >
        <div className="employee-details">
          <section className="employee-details__summary">
            <EmployeeAvatar name={employee.full_name} size="lg" />
            <div className="employee-details__summary-text">
              <strong>{t(`roles.${employee.staff_type}`)}</strong>
              <span>{`${shiftLabel} · ${t(`statuses.${status}`)}`}</span>
            </div>
            <Badge tone={STATUS_TONE[status]} className="employee-details__account">
              {t(employee.is_active ? 'accountActive' : 'statuses.INACTIVE')}
            </Badge>
          </section>

          <div className="employee-details__grid">
            <EmployeeInfoTile label={t('fields.staffType')}>{t(`roles.${employee.staff_type}`)}</EmployeeInfoTile>
            <EmployeeInfoTile label={t('fields.hireDate')}>{formatDay(employee.hire_date, language)}</EmployeeInfoTile>
            <EmployeeInfoTile label={t('tilePhone')}><bdi dir="ltr">{formatPhone(employee.phone, language)}</bdi></EmployeeInfoTile>
            <EmployeeInfoTile label={t('tileEmail')}><bdi dir="ltr">{employee.email}</bdi></EmployeeInfoTile>
            <EmployeeInfoTile label={t('tileStatus')}>{t(`statuses.${status}`)}</EmployeeInfoTile>
            <EmployeeInfoTile label={t('tileLastLogin')}>{formatLastLogin(employee.last_login_at, language)}</EmployeeInfoTile>
            <EmployeeInfoTile label={t('fields.nationalId')}><bdi dir="ltr">{formatMaskedId(employee.national_id, language)}</bdi></EmployeeInfoTile>
            <EmployeeInfoTile label={t('tileWorkload')}>
              {employee.workload
                ? t('workloadValue')
                  .replace('{done}', formatNumber(employee.workload.completed_today, language))
                  .replace('{total}', formatNumber(employee.workload.assigned_today, language))
                : '—'}
            </EmployeeInfoTile>
          </div>

          <section className="employee-details__actions" aria-label={t('accountActions')}>
            <h3>{t('accountActions')}</h3>
            <div>
              {employee.is_active ? (
                <>
                  <Button variant="secondary" onClick={() => setConfirm('reset')} disabled={isActing}>
                    <KeyRound aria-hidden="true" />
                    {t('resetPassword')}
                  </Button>
                  <Button variant="secondary" className="employee-details__danger" onClick={() => setConfirm('deactivate')} disabled={isActing}>
                    <UserX aria-hidden="true" />
                    {t('deactivate')}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => { void onSetActive(true); }} disabled={isActing}>
                  <UserCheck aria-hidden="true" />
                  {t('reactivate')}
                </Button>
              )}
            </div>
          </section>
        </div>
      </Drawer>

      {confirm && (
        <ConfirmDialog
          icon={confirm === 'reset' ? <KeyRound /> : <UserX />}
          title={t(confirm === 'reset' ? 'resetConfirmTitle' : 'deactivateConfirmTitle').replace('{name}', employee.full_name)}
          description={t(confirm === 'reset' ? 'resetConfirmText' : 'deactivateConfirmText')}
          confirmLabel={t(confirm === 'reset' ? 'resetPassword' : 'deactivate')}
          cancelLabel={t('cancel')}
          variant={confirm === 'deactivate' ? 'danger' : 'default'}
          busy={isActing}
          onConfirm={() => { void runConfirm(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

interface EditEmployeeProps {
  employee: Staff;
  others: Staff[];
  isSaving: boolean;
  onClose: () => void;
  onCancel: () => void;
  onSave: (body: StaffUpdate) => Promise<'email' | 'national_id' | null>;
}

function EditEmployee({ employee, others, isSaving, onClose, onCancel, onSave }: EditEmployeeProps) {
  const { t: translate } = useLanguage();
  const t = (key: string) => translate(`${EMPLOYEES_I18N}.${key}`);
  const form = useEmployeeForm({
    initialValues: toFormValues(employee),
    mode: 'edit',
    others,
    onValid: (values) => {
      if (isSaving) return;
      void onSave(toUpdateStaffBody(values)).then((conflict) => {
        if (conflict === 'email') form.setFieldError('email', 'emailTaken');
      });
    },
  });

  return (
    <Drawer
      open
      eyebrow={t('editEyebrow')}
      title={employee.full_name}
      closeLabel={t('close')}
      onClose={onClose}
      className="employee-drawer"
      footer={(
        <div className="employee-drawer__footer">
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
          <Button type="submit" form={FORM_ID} disabled={isSaving}>{isSaving ? t('saving') : t('saveChanges')}</Button>
        </div>
      )}
    >
      <form id={FORM_ID} onSubmit={form.handleSubmit} noValidate>
        <EmployeeFormFields
          values={form.values}
          errors={form.errors}
          mode="edit"
          disabled={isSaving}
          fieldId={form.fieldId}
          onChange={form.setField}
        />
      </form>
    </Drawer>
  );
}
