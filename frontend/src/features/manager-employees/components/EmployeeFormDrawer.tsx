import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { EMPLOYEES_I18N } from '../constants/employees.constants';
import { useEmployeeForm } from '../hooks/useEmployeeForm';
import { emptyEmployeeForm, toCreateStaffBody } from '../schemas/employee.schema';
import type { ShiftType, Staff, StaffCreate } from '../types/employee.types';
import { cairoBusinessDate } from '../utils/employeeDisplay';
import { EmployeeFormFields } from './EmployeeFormFields';
import './EmployeeDrawers.css';

const FORM_ID = 'manager-employee-create-form';

interface EmployeeFormDrawerProps {
  open: boolean;
  employees: Staff[];
  isSaving: boolean;
  onClose: () => void;
  /** Resolves to a field name when the server rejects a duplicate */
  onSubmit: (body: StaffCreate, shift: ShiftType | null) => Promise<'email' | 'national_id' | null>;
}

// "إضافة موظف" (image 3.1). The parent remounts it with `key`, so it always opens empty.
export function EmployeeFormDrawer({ open, employees, isSaving, onClose, onSubmit }: EmployeeFormDrawerProps) {
  const { t: translate } = useLanguage();
  const t = (key: string) => translate(`${EMPLOYEES_I18N}.${key}`);
  const form = useEmployeeForm({
    initialValues: emptyEmployeeForm(cairoBusinessDate()),
    mode: 'create',
    others: employees,
    onValid: (values) => {
      if (isSaving) return;
      const { body, shift } = toCreateStaffBody(values);
      void onSubmit(body, shift).then((conflict) => {
        if (conflict === 'email') form.setFieldError('email', 'emailTaken');
        if (conflict === 'national_id') form.setFieldError('nationalId', 'nationalIdTaken');
      });
    },
  });

  return (
    <Drawer
      open={open}
      eyebrow={t('addEyebrow')}
      title={t('addTitle')}
      closeLabel={t('close')}
      onClose={onClose}
      className="employee-drawer"
      footer={(
        <div className="employee-drawer__footer">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>{t('cancel')}</Button>
          <Button type="submit" form={FORM_ID} disabled={isSaving}>{isSaving ? t('saving') : t('saveEmployee')}</Button>
        </div>
      )}
    >
      <form id={FORM_ID} onSubmit={form.handleSubmit} noValidate>
        <EmployeeFormFields
          values={form.values}
          errors={form.errors}
          mode="create"
          disabled={isSaving}
          fieldId={form.fieldId}
          onChange={form.setField}
        />
      </form>
    </Drawer>
  );
}
