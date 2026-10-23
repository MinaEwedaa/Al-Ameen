import { KeyRound } from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import {
  EMAIL_MAX_LENGTH,
  EMPLOYEES_I18N,
  FULL_NAME_MAX_LENGTH,
  NO_SHIFT,
  SHIFT_OPTIONS,
  STAFF_TYPE_OPTIONS,
} from '../constants/employees.constants';
import type { EmployeeFormErrors, EmployeeFormField, EmployeeFormValues } from '../schemas/employee.schema';
import './EmployeeFormFields.css';

interface EmployeeFormFieldsProps {
  values: EmployeeFormValues;
  errors: EmployeeFormErrors;
  mode: 'create' | 'edit';
  disabled: boolean;
  fieldId: (field: EmployeeFormField) => string;
  onChange: <K extends EmployeeFormField>(field: K, value: EmployeeFormValues[K]) => void;
}

type TextField = 'fullName' | 'nationalId' | 'phone' | 'email' | 'hireDate';

// The add drawer (image 3.1) and the edit mode of the details drawer.
// Contract v1.1: no username (sign-in is by email) and the temporary password comes from the server.
export function EmployeeFormFields({ values, errors, mode, disabled, fieldId, onChange }: EmployeeFormFieldsProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${EMPLOYEES_I18N}.${key}`);

  const errorText = (field: EmployeeFormField) => {
    const key = errors[field];
    if (!key) return undefined;
    return t(`errors.${key}`).replace('{max}', formatNumber(FULL_NAME_MAX_LENGTH, language));
  };

  const textField = (
    field: TextField,
    options: { type?: string; inputMode?: 'numeric' | 'tel' | 'email' | 'text'; maxLength?: number; ltr?: boolean; autoComplete?: string; optional?: boolean },
  ) => {
    const error = errorText(field);
    const id = fieldId(field);
    return (
      <label className="employee-form__field" htmlFor={id}>
        <span>
          {t(`fields.${field}`)}
          {options.optional && <small className="employee-form__optional">{t('optional')}</small>}
        </span>
        <input
          id={id}
          type={options.type ?? 'text'}
          inputMode={options.inputMode}
          dir={options.ltr ? 'ltr' : undefined}
          autoComplete={options.autoComplete ?? 'off'}
          placeholder={options.type === 'date' ? undefined : t(`placeholders.${field}`)}
          value={values[field]}
          maxLength={options.maxLength}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={error ? 'employee-form__control--error' : undefined}
          onChange={(event) => onChange(field, event.target.value)}
        />
        {error && <span id={`${id}-error`} className="employee-form__error">{error}</span>}
      </label>
    );
  };

  const roleSelect = (
    <Select
      id={fieldId('staffType')}
      label={t('fields.staffType')}
      value={values.staffType}
      placeholder={t('placeholders.staffType')}
      options={STAFF_TYPE_OPTIONS.map((type) => ({ value: type, label: t(`roles.${type}`) }))}
      onChange={(next) => onChange('staffType', next as EmployeeFormValues['staffType'])}
      error={errorText('staffType')}
      disabled={disabled}
    />
  );

  if (mode === 'edit') {
    return (
      <div className="employee-form">
        <div className="employee-form__row">
          {textField('fullName', { maxLength: FULL_NAME_MAX_LENGTH, autoComplete: 'name' })}
          {textField('phone', { type: 'tel', inputMode: 'tel', maxLength: 17, ltr: true })}
        </div>
        <div className="employee-form__row">
          {textField('email', { type: 'email', inputMode: 'email', maxLength: EMAIL_MAX_LENGTH, ltr: true })}
          {roleSelect}
        </div>
      </div>
    );
  }

  return (
    <div className="employee-form">
      <div className="employee-form__row">
        {textField('fullName', { maxLength: FULL_NAME_MAX_LENGTH, autoComplete: 'name' })}
        {textField('nationalId', { inputMode: 'numeric', maxLength: 14, optional: true })}
      </div>
      <div className="employee-form__row">
        {textField('phone', { type: 'tel', inputMode: 'tel', maxLength: 17, ltr: true })}
        {textField('email', { type: 'email', inputMode: 'email', maxLength: EMAIL_MAX_LENGTH, ltr: true })}
      </div>
      <div className="employee-form__row">
        {roleSelect}
        {textField('hireDate', { type: 'date' })}
      </div>
      <Select
        id={fieldId('shift')}
        label={t('fields.shift')}
        value={values.shift}
        placeholder={t('placeholders.shift')}
        options={[
          ...SHIFT_OPTIONS.map((shift) => ({ value: shift, label: t(`shifts.${shift}`) })),
          { value: NO_SHIFT, label: t('shifts.NONE') },
        ]}
        onChange={(next) => onChange('shift', next as EmployeeFormValues['shift'])}
        error={errorText('shift')}
        disabled={disabled}
      />
      <p className="employee-form__note">
        <KeyRound aria-hidden="true" />
        {t('passwordNote')}
      </p>
    </div>
  );
}
