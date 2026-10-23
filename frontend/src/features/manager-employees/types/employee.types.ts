// Shapes from Manager API Contract v1.2 (§5 Staff, §6 Shifts overview).

/** v1.2: MongoDB ObjectId sent as a string, e.g. "6719b4a1f2e8c90012ab34cd" */
export type EntityId = string;

export type StaffType = 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPER' | 'TECHNICIAN' | 'ADMIN';
export type ShiftType = 'MORNING' | 'EVENING' | 'NIGHT';
export type ShiftStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
/** TODO confirm with backend: the contract example shows only "AVAILABLE" */
export type Presence = 'ON_DUTY' | 'AVAILABLE' | 'ON_BREAK';

export interface TodayShift {
  shift_id: EntityId;
  shift_type: ShiftType;
  status: ShiftStatus;
  /** null = not checked in */
  presence: Presence | null;
}

export interface Workload {
  assigned_today: number;
  completed_today: number;
  open: number;
}

/** GET /staff?include=today_shift,workload */
export interface Staff {
  staff_id: EntityId;
  user_id?: EntityId;
  full_name: string;
  email: string;
  phone: string;
  /** Masked by the server, e.g. ******4567 */
  national_id: string | null;
  staff_type: StaffType;
  hire_date: string;
  is_active: boolean;
  last_login_at: string | null;
  today_shift?: TodayShift | null;
  workload?: Workload | null;
}

/** POST /staff — the server generates the temporary password */
export interface StaffCreate {
  full_name: string;
  email: string;
  phone: string;
  staff_type: StaffType;
  hire_date: string;
  national_id?: string;
}

export interface StaffCreated extends Staff {
  temporary_password: string;
}

/** PATCH /staff/{id} */
export interface StaffUpdate {
  full_name: string;
  email: string;
  phone: string;
  staff_type: StaffType;
}

/** GET /shifts/overview — only what the coverage columns need */
export interface ShiftCoverage {
  shift_type: ShiftType;
  shift_id: EntityId | null;
  status: ShiftStatus;
  start_time: string;
  end_time: string;
  staff: { staff_id: EntityId; full_name: string } | null;
  team_count: number;
}

/** What the page shows in the status column */
export type EmployeeStatus = 'ON_DUTY' | 'AVAILABLE' | 'ON_BREAK' | 'OFF_SHIFT' | 'INACTIVE';

export interface EmployeeFilters {
  q: string;
  role: StaffType | '';
  shift: ShiftType | 'NONE' | '';
  status: EmployeeStatus | '';
  page: number;
}

export type EmployeeFilterName = Exclude<keyof EmployeeFilters, 'q' | 'page'>;
