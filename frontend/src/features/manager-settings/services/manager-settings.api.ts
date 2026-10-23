import { request } from '../../../core/api/apiClient';
import type {
  ManagerSettings,
  HotelInfoSettings,
  ShiftTiming,
  NotificationSettings,
  AppearanceMode,
  ApiHotelSettings,
  ApiShiftSettings,
  ApiNotificationPreferences,
} from '../types/manager-settings.types';

// ---------- Mappers between Contract Sec 12 Schemas & UI Models ----------
function mapApiToHotelInfo(api: ApiHotelSettings): HotelInfoSettings {
  return {
    hotelName: api.name,
    location: api.location,
    floorsCount: api.floors_count,
    totalRooms: api.total_rooms,
  };
}

function mapHotelInfoToApi(info: Partial<HotelInfoSettings>): Partial<ApiHotelSettings> {
  return {
    name: info.hotelName,
    location: info.location,
    floors_count: info.floorsCount,
    total_rooms: info.totalRooms,
  };
}

function mapApiToShifts(api: ApiShiftSettings): ShiftTiming[] {
  return [
    {
      id: 'morning',
      name: 'الصباحية',
      startTime: api.morning?.start || '07:00',
      endTime: api.morning?.end || '16:00',
    },
    {
      id: 'evening',
      name: 'المسائية',
      startTime: api.evening?.start || '16:00',
      endTime: api.evening?.end || '23:00',
    },
    {
      id: 'night',
      name: 'الليلية',
      startTime: api.night?.start || '23:00',
      endTime: api.night?.end || '07:00',
    },
  ];
}

function mapShiftsToApi(shifts: ShiftTiming[]): ApiShiftSettings {
  const morning = shifts.find((s) => s.id === 'morning') || { startTime: '07:00', endTime: '16:00' };
  const evening = shifts.find((s) => s.id === 'evening') || { startTime: '16:00', endTime: '23:00' };
  const night = shifts.find((s) => s.id === 'night') || { startTime: '23:00', endTime: '07:00' };

  return {
    morning: { start: morning.startTime, end: morning.endTime },
    evening: { start: evening.startTime, end: evening.endTime },
    night: { start: night.startTime, end: night.endTime },
  };
}

function mapApiToNotifications(api: ApiNotificationPreferences): NotificationSettings {
  return {
    maintenance: api.critical_maintenance ?? true,
    cleaning: api.critical_complaints ?? true,
    payments: api.approval_requests ?? true,
    pendingTasks: api.system_alerts ?? true,
    shiftHandover: api.leave_requests ?? true,
    reports: api.shift_reports ?? true,
    approval_requests: api.approval_requests,
    leave_requests: api.leave_requests,
    critical_maintenance: api.critical_maintenance,
    critical_complaints: api.critical_complaints,
    shift_reports: api.shift_reports,
    system_alerts: api.system_alerts,
  };
}

function mapNotificationsToApi(notifs: Partial<NotificationSettings>): Partial<ApiNotificationPreferences> {
  return {
    approval_requests: notifs.approval_requests ?? notifs.payments,
    leave_requests: notifs.leave_requests ?? notifs.shiftHandover,
    critical_maintenance: notifs.critical_maintenance ?? notifs.maintenance,
    critical_complaints: notifs.critical_complaints ?? notifs.cleaning,
    shift_reports: notifs.shift_reports ?? notifs.reports,
    system_alerts: notifs.system_alerts ?? notifs.pendingTasks,
  };
}

// ---------- Contract Sec 12 Endpoints ----------

/**
 * GET /api/v1/hotel-settings
 */
export async function getHotelSettings(): Promise<HotelInfoSettings> {
  const res = await request<{ data: ApiHotelSettings } | ApiHotelSettings>('/hotel-settings');
  const data = 'data' in res && res.data ? res.data : (res as ApiHotelSettings);
  return mapApiToHotelInfo(data);
}

/**
 * PATCH /api/v1/hotel-settings
 */
export async function updateHotelSettings(payload: Partial<HotelInfoSettings>): Promise<HotelInfoSettings> {
  const body = mapHotelInfoToApi(payload);
  const res = await request<{ data: ApiHotelSettings } | ApiHotelSettings>('/hotel-settings', {
    method: 'PATCH',
    body,
  });
  const data = 'data' in res && res.data ? res.data : (res as ApiHotelSettings);
  return mapApiToHotelInfo(data);
}

/**
 * GET /api/v1/shift-settings
 */
export async function getShiftSettings(): Promise<ShiftTiming[]> {
  const res = await request<{ data: ApiShiftSettings } | ApiShiftSettings>('/shift-settings');
  const data = 'data' in res && res.data ? res.data : (res as ApiShiftSettings);
  return mapApiToShifts(data);
}

/**
 * PATCH /api/v1/shift-settings
 */
export async function updateShiftSettings(shifts: ShiftTiming[]): Promise<ShiftTiming[]> {
  const body = mapShiftsToApi(shifts);
  const res = await request<{ data: ApiShiftSettings } | ApiShiftSettings>('/shift-settings', {
    method: 'PATCH',
    body,
  });
  const data = 'data' in res && res.data ? res.data : (res as ApiShiftSettings);
  return mapApiToShifts(data);
}

/**
 * GET /api/v1/notifications/preferences
 */
export async function getNotificationPreferences(): Promise<NotificationSettings> {
  const res = await request<{ data: ApiNotificationPreferences } | ApiNotificationPreferences>(
    '/notifications/preferences',
  );
  const data = 'data' in res && res.data ? res.data : (res as ApiNotificationPreferences);
  return mapApiToNotifications(data);
}

/**
 * PATCH /api/v1/notifications/preferences
 */
export async function updateNotificationPreferences(
  payload: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const body = mapNotificationsToApi(payload);
  const res = await request<{ data: ApiNotificationPreferences } | ApiNotificationPreferences>(
    '/notifications/preferences',
    {
      method: 'PATCH',
      body,
    },
  );
  const data = 'data' in res && res.data ? res.data : (res as ApiNotificationPreferences);
  return mapApiToNotifications(data);
}

/**
 * Aggregated Settings Service for ManagerSettingsPage
 */
export async function getManagerSettings(): Promise<ManagerSettings> {
  const [hotelInfo, shifts, notifications] = await Promise.all([
    getHotelSettings(),
    getShiftSettings(),
    getNotificationPreferences(),
  ]);

  const savedTheme =
    typeof window !== 'undefined'
      ? ((localStorage.getItem('al-amin-theme') as AppearanceMode) ||
        (localStorage.getItem('theme') as AppearanceMode) ||
        'light')
      : 'light';

  return {
    hotelInfo,
    shifts,
    notifications,
    language: 'ar',
    appearance: savedTheme,
    lastAutoSaved: new Date().toISOString(),
  };
}

export async function updateManagerSettings(
  settings: Partial<ManagerSettings>,
): Promise<ManagerSettings> {
  const promises: Promise<unknown>[] = [];

  if (settings.hotelInfo) {
    promises.push(updateHotelSettings(settings.hotelInfo));
  }
  if (settings.shifts) {
    promises.push(updateShiftSettings(settings.shifts));
  }
  if (settings.notifications) {
    promises.push(updateNotificationPreferences(settings.notifications));
  }

  await Promise.all(promises);
  return getManagerSettings();
}
