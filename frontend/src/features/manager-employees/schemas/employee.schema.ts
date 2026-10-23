import { normalizeDigits } from '../../../utils/digits';
import {
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  NO_SHIFT,
  SHIFT_OPTIONS,
  STAFF_TYPE_OPTIONS,
} from '../constants/employees.constants';
import type { ShiftType, Staff, StaffCreate, StaffType, StaffUpdate } from '../types/employee.types';

export interface EmployeeFormValues {
  fullName: string;
  /** Optional; create only (the server returns it masked) */
  nationalId: string;
  phone: string;
  email: string;
  staffType: StaffType | '';
  /** YYYY-MM-DD; create only */
  hireDate: string;
  /** Today's shift; create only */
  shift: ShiftType | typeof NO_SHIFT | '';
}

export type EmployeeFormField = keyof EmployeeFormValues;

/** Values are i18n keys under manager.employees.errors, the component translates them */
export type EmployeeFormErrors = Partial<Record<EmployeeFormField, string>>;

export function emptyEmployeeForm(today: string): EmployeeFormValues {
  return { fullName: '', nationalId: '', phone: '', email: '', staffType: '', hireDate: today, shift: '' };
}

/** Field order on screen, used to focus the first field with an error */
export const EMPLOYEE_FIELD_ORDER: EmployeeFormField[] = ['fullName', 'nationalId', 'phone', 'email', 'staffType', 'hireDate', 'shift'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Egyptian national ID: 14 digits, starts with 2 (born 1900s) or 3 (born 2000s)
const NATIONAL_ID_PATTERN = /^[23]\d{13}$/;
// Egyptian mobile numbers: 010, 011, 012 or 015 followed by 8 digits
const PHONE_PATTERN = /^\+201[0125]\d{8}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts 01001234567, +20 100 123 4567, 00201001234567 or 1001234567 and returns +201001234567 */
export function normalizePhone(value: string): string {
  const digits = normalizeDigits(value).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0020')) return `+${digits.slice(2)}`;
  if (digits.startsWith('20') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  if (digits.startsWith('1') && digits.length === 10) return `+20${digits}`;
  return digits;
}

interface ValidateOptions {
  mode: 'create' | 'edit';
  /** Everyone else, to keep active emails unique (the server has the final word) */
  others: Staff[];
  /** Today's business date, the latest allowed hire date is a year ahead */
  today: string;
}

export function validateEmployee(values: EmployeeFormValues, { mode, others, today }: ValidateOptions): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  const fullName = values.fullName.trim();
  const phone = normalizePhone(values.phone);
  const email = values.email.trim().toLowerCase();

  if (!fullName) errors.fullName = 'required';
  else if (fullName.length < 3) errors.fullName = 'nameTooShort';
  else if (fullName.length > FULL_NAME_MAX_LENGTH) errors.fullName = 'nameTooLong';

  if (!values.phone.trim()) errors.phone = 'required';
  else if (!PHONE_PATTERN.test(phone)) errors.phone = 'phoneInvalid';

  if (!email) errors.email = 'required';
  else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) errors.email = 'emailInvalid';
  else if (others.some((member) => member.is_active && member.email.toLowerCase() === email)) errors.email = 'emailTaken';

  if (!values.staffType || !STAFF_TYPE_OPTIONS.includes(values.staffType)) errors.staffType = 'roleRequired';

  if (mode === 'create') {
    const nationalId = normalizeDigits(values.nationalId.trim());
    if (nationalId) {
      if (!/^\d+$/.test(nationalId) || nationalId.length !== 14) errors.nationalId = 'nationalIdLength';
      else if (!NATIONAL_ID_PATTERN.test(nationalId)) errors.nationalId = 'nationalIdInvalid';
    }

    if (!values.hireDate) errors.hireDate = 'required';
    else if (!DATE_PATTERN.test(values.hireDate)) errors.hireDate = 'dateInvalid';
    else if (values.hireDate > `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`) errors.hireDate = 'dateTooFar';

    if (!values.shift || (values.shift !== NO_SHIFT && !SHIFT_OPTIONS.includes(values.shift))) errors.shift = 'shiftRequired';
  }

  return errors;
}

export function hasErrors(errors: EmployeeFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Call only after validateEmployee returned no errors */
export function toCreateStaffBody(values: EmployeeFormValues): { body: StaffCreate; shift: ShiftType | null } {
  const nationalId = normalizeDigits(values.nationalId.trim());
  return {
    body: {
      full_name: values.fullName.trim().replace(/\s+/g, ' '),
      email: values.email.trim().toLowerCase(),
      phone: normalizePhone(values.phone),
      staff_type: values.staffType as StaffType,
      hire_date: values.hireDate,
      ...(nationalId ? { national_id: nationalId } : {}),
    },
    shift: values.shift && values.shift !== NO_SHIFT ? values.shift : null,
  };
}

/** Call only after validateEmployee returned no errors */
export function toUpdateStaffBody(values: EmployeeFormValues): StaffUpdate {
  return {
    full_name: values.fullName.trim().replace(/\s+/g, ' '),
    email: values.email.trim().toLowerCase(),
    phone: normalizePhone(values.phone),
    staff_type: values.staffType as StaffType,
  };
}

/** Pre-fills the edit form */
export function toFormValues(member: Staff): EmployeeFormValues {
  return {
    fullName: member.full_name,
    nationalId: '',
    phone: member.phone,
    email: member.email,
    staffType: member.staff_type,
    hireDate: member.hire_date,
    shift: member.today_shift?.shift_type ?? NO_SHIFT,
  };
}
