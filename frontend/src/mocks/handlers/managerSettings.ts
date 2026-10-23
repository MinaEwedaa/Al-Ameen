import { http, HttpResponse } from 'msw';
import type {
  ApiHotelSettings,
  ApiShiftSettings,
  ApiNotificationPreferences,
} from '../../features/manager-settings/types/manager-settings.types';

const API = '/api/v1';

// Contract Sec 12 Mock Databases
let currentHotelSettings: ApiHotelSettings = {
  name: 'فندق الأمين - أسوان',
  location: 'أسوان، مصر',
  floors_count: 3,
  total_rooms: 36,
};

let currentShiftSettings: ApiShiftSettings = {
  morning: { start: '07:00', end: '16:00' },
  evening: { start: '16:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
};

let currentNotificationPreferences: ApiNotificationPreferences = {
  approval_requests: true,
  leave_requests: true,
  critical_maintenance: true,
  critical_complaints: true,
  shift_reports: true,
  system_alerts: true,
};

export const managerSettingsHandlers = [
  /**
   * Contract Sec 12:
   * GET /api/v1/hotel-settings
   */
  http.get(`${API}/hotel-settings`, () => {
    return HttpResponse.json({ data: currentHotelSettings });
  }),

  /**
   * Contract Sec 12:
   * PATCH /api/v1/hotel-settings
   */
  http.patch(`${API}/hotel-settings`, async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as Partial<ApiHotelSettings>;
    currentHotelSettings = {
      ...currentHotelSettings,
      ...payload,
    };
    return HttpResponse.json({ data: currentHotelSettings });
  }),

  /**
   * Contract Sec 12:
   * GET /api/v1/shift-settings
   */
  http.get(`${API}/shift-settings`, () => {
    return HttpResponse.json({ data: currentShiftSettings });
  }),

  /**
   * Contract Sec 12:
   * PATCH /api/v1/shift-settings
   */
  http.patch(`${API}/shift-settings`, async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as Partial<ApiShiftSettings>;
    currentShiftSettings = {
      morning: payload.morning ? { ...currentShiftSettings.morning, ...payload.morning } : currentShiftSettings.morning,
      evening: payload.evening ? { ...currentShiftSettings.evening, ...payload.evening } : currentShiftSettings.evening,
      night: payload.night ? { ...currentShiftSettings.night, ...payload.night } : currentShiftSettings.night,
    };
    return HttpResponse.json({ data: currentShiftSettings });
  }),

  /**
   * Contract Sec 12:
   * GET /api/v1/notifications/preferences
   */
  http.get(`${API}/notifications/preferences`, () => {
    return HttpResponse.json({ data: currentNotificationPreferences });
  }),

  /**
   * Contract Sec 12:
   * PATCH /api/v1/notifications/preferences
   */
  http.patch(`${API}/notifications/preferences`, async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as Partial<ApiNotificationPreferences>;
    currentNotificationPreferences = {
      ...currentNotificationPreferences,
      ...payload,
    };
    return HttpResponse.json({ data: currentNotificationPreferences });
  }),

  /**
   * Contract Sec 12:
   * GET /api/v1/search?q={query}
   * Topbar omnibox search returning rooms, staff, or report suggestions
   */
  http.get(`${API}/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const mockSearchResults = [
      { id: 'room-101', type: 'room', title: 'غرفة 101', subtitle: 'الطابق الأول · جناح ملكي' },
      { id: 'room-204', type: 'room', title: 'غرفة 204', subtitle: 'الطابق الثاني · غرفة مفردة' },
      { id: 'staff-1', type: 'staff', title: 'كريم نبيل', subtitle: 'موظف استقبال · الوردية الصباحية' },
      { id: 'staff-2', type: 'staff', title: 'سارة محمود', subtitle: 'مشرفة نظافة · الوردية المسائية' },
      { id: 'report-1', type: 'report', title: 'تقرير الإشغال الشهري', subtitle: 'أكتوبر 2026' },
      { id: 'report-2', type: 'report', title: 'تقرير الصيانة الدوري', subtitle: 'الربع الثالث 2026' },
    ];

    const results = q
      ? mockSearchResults.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q),
        )
      : mockSearchResults.slice(0, 4);

    return HttpResponse.json({ data: results });
  }),

  // Compatibility handler for legacy /manager/settings
  http.get(`${API}/manager/settings`, () => {
    const savedTheme =
      typeof window !== 'undefined'
        ? ((localStorage.getItem('al-amin-theme') as 'light' | 'dark' | 'system') ||
          (localStorage.getItem('theme') as 'light' | 'dark' | 'system'))
        : null;

    return HttpResponse.json({
      hotelInfo: {
        hotelName: currentHotelSettings.name,
        location: currentHotelSettings.location,
        floorsCount: currentHotelSettings.floors_count,
        totalRooms: currentHotelSettings.total_rooms,
      },
      shifts: [
        { id: 'morning', name: 'الصباحية', startTime: currentShiftSettings.morning.start, endTime: currentShiftSettings.morning.end },
        { id: 'evening', name: 'المسائية', startTime: currentShiftSettings.evening.start, endTime: currentShiftSettings.evening.end },
        { id: 'night', name: 'الليلية', startTime: currentShiftSettings.night.start, endTime: currentShiftSettings.night.end },
      ],
      notifications: {
        maintenance: currentNotificationPreferences.critical_maintenance,
        cleaning: currentNotificationPreferences.critical_complaints,
        payments: currentNotificationPreferences.approval_requests,
        pendingTasks: currentNotificationPreferences.system_alerts,
        shiftHandover: currentNotificationPreferences.leave_requests,
        reports: currentNotificationPreferences.shift_reports,
      },
      language: 'ar',
      appearance: savedTheme || 'light',
      lastAutoSaved: new Date().toISOString(),
    });
  }),
];
