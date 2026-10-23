// =====================================================================
// Manager Settings Types — Contract v1.2 Specifications & UI Models
// =====================================================================

// ---------- Contract Sec 12 API Schemas ----------
export interface ApiHotelSettings {
  name: string;
  location: string;
  floors_count: number;
  total_rooms: number;
}

export interface ApiShiftBoundary {
  start: string;
  end: string;
}

export interface ApiShiftSettings {
  morning: ApiShiftBoundary;
  evening: ApiShiftBoundary;
  night: ApiShiftBoundary;
}

export interface ApiNotificationPreferences {
  approval_requests: boolean;
  leave_requests: boolean;
  critical_maintenance: boolean;
  critical_complaints: boolean;
  shift_reports: boolean;
  system_alerts: boolean;
}

// ---------- UI View Models ----------
export interface HotelInfoSettings {
  hotelName: string;
  location: string;
  floorsCount: number;
  totalRooms: number;
}

export type ShiftId = 'morning' | 'evening' | 'night';

export interface ShiftTiming {
  id: ShiftId;
  name: string;
  startTime: string; // e.g. "07:00"
  endTime: string;   // e.g. "15:00"
}

export interface NotificationSettings {
  maintenance: boolean;
  cleaning: boolean;
  payments: boolean;
  pendingTasks: boolean;
  shiftHandover: boolean;
  reports: boolean;
  // Optional direct contract key bindings
  approval_requests?: boolean;
  leave_requests?: boolean;
  critical_maintenance?: boolean;
  critical_complaints?: boolean;
  shift_reports?: boolean;
  system_alerts?: boolean;
}

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface ManagerSettings {
  hotelInfo: HotelInfoSettings;
  shifts: ShiftTiming[];
  notifications: NotificationSettings;
  language: 'ar' | 'en';
  appearance: AppearanceMode;
  lastAutoSaved?: string;
}

export type SettingsTabId = 'hotel' | 'shifts' | 'notifications' | 'language' | 'appearance';
