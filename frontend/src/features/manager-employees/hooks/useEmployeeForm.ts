import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { EMPLOYEE_FIELD_ORDER, hasErrors, validateEmployee } from '../schemas/employee.schema';
import type { EmployeeFormErrors, EmployeeFormField, EmployeeFormValues } from '../schemas/employee.schema';
import type { Staff } from '../types/employee.types';
import { cairoBusinessDate } from '../utils/employeeDisplay';

interface UseEmployeeFormOptions {
  initialValues: EmployeeFormValues;
  mode: 'create' | 'edit';
  /** Everyone except the employee being edited (uniqueness checks) */
  others: Staff[];
  onValid: (values: EmployeeFormValues) => void;
}

// Form state shared by the add drawer and the edit mode of the details drawer.
// Errors show after the first submit, then update live while the user fixes them.
export function useEmployeeForm({ initialValues, mode, others, onValid }: UseEmployeeFormOptions) {
  const baseId = useId();
  const fieldId = (field: EmployeeFormField) => `${baseId}-${field}`;
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const options = { mode, others, today: cairoBusinessDate() };

  const setField = <K extends EmployeeFormField>(field: K, value: EmployeeFormValues[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validateEmployee(next, options));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validateEmployee(values, options);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      const firstInvalid = EMPLOYEE_FIELD_ORDER.find((field) => nextErrors[field]);
      if (firstInvalid) document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    onValid(values);
  };

  /** Server-side conflicts (e.g. an email taken meanwhile) are shown under the field */
  const setFieldError = (field: EmployeeFormField, key: string) => {
    setErrors((current) => ({ ...current, [field]: key }));
    document.getElementById(fieldId(field))?.focus();
  };

  return { values, errors, fieldId, setField, handleSubmit, setFieldError };
}
