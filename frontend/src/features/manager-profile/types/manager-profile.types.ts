// =====================================================================
// Manager Profile Types — Contract v1.2 Specifications & UI View Models
// =====================================================================

// ---------- Contract Sec 2 API Schemas ----------
export interface ApiMeProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  staff_type: 'MANAGER' | string;
  is_active: boolean;
}

export interface ApiMeStats {
  audits_this_month: number;
  decisions_this_month: number;
  active_employees: number;
  occupancy_rate: number;
}

export interface ApiMeActivity {
  id: string;
  action: string;
  description: string;
  created_at: string;
}

export interface ApiUpdateMePayload {
  full_name: string;
  phone: string;
  email: string;
}

export interface ApiChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface ApiSingleResponse<T> {
  data: T;
}

// ---------- UI View Models (Consumed by Member A components) ----------
export interface ManagerProfile {
  id: string;
  name: string;
  accountName: string;
  role: string;
  hotelName: string;
  location: string;
  email: string;
  phone: string;
  hireDate: string;
  lastLogin: string;
  status: 'active' | 'inactive';
}

export interface ManagerKPIs {
  activeEmployees: number;
  activeEmployeesSub: string;
  managedRooms: number;
  managedRoomsSub: string;
  generatedReports: number;
  generatedReportsSub: string;
  managementTasks: number;
  managementTasksSub: string;
}

export interface ManagerActivityItem {
  id: string;
  type: 'payment' | 'cleaning' | 'maintenance' | 'other';
  title: string;
  description: string;
  time: string;
  /** Raw ISO time from /auth/me/activities, formatted per language in the timeline */
  timestamp?: string;
  tone?: 'green' | 'gold' | 'blue';
}

export interface EditProfilePayload {
  name: string;
  email: string;
  phone: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
