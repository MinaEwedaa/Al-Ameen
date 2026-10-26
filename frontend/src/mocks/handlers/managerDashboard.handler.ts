import { http, HttpResponse, delay } from 'msw';
import type {
  DashboardOverviewDto,
  DashboardRevenueDto,
  DashboardIssueDto,
  HotelActivityDto,
} from '../../features/manager-dashboard/types/manager-dashboard.dto';

const API = '/api/v1';

function shouldMockError(requestUrl: string): boolean {
  try {
    const reqUrl = new URL(requestUrl);
    if (reqUrl.searchParams.get('mockError') === '1') {
      return true;
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.location) {
    try {
      const pageUrl = new URL(window.location.href);
      if (pageUrl.searchParams.get('mockError') === '1') {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function mockErrorResponse() {
  return HttpResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'محاكاة خطأ اختباري (mockError=1)',
        details: { field: 'mockError', issue: 'forced_test_error' },
      },
    },
    { status: 400 }
  );
}

export const mockDashboardOverviewDto: DashboardOverviewDto = {
  kpis: {
    total_rooms: 36,
    occupied_rooms: 23,
    available_rooms: 7,
    cleaning_rooms: 3,
    maintenance_rooms: 3,
    occupancy_rate: 64,
    today_revenue: 24850.00,
    today_revenue_change_pct: 12.4,
    pending_tasks: 9,
  },
  room_counts: {
    total: 36,
    standard: 21,
    vip: 15,
    occupied: 23,
    available: 7,
    reserved: 2,
    cleaning: 3,
    maintenance: 3,
  },
  floors_occupancy: [
    {
      floor: 1,
      total: 12,
      occupied: 8,
      standard_count: 7,
      vip_count: 5,
      occupancy_pct: 72,
    },
    {
      floor: 2,
      total: 12,
      occupied: 8,
      standard_count: 7,
      vip_count: 5,
      occupancy_pct: 63,
    },
    {
      floor: 3,
      total: 12,
      occupied: 7,
      standard_count: 7,
      vip_count: 5,
      occupancy_pct: 54,
    },
  ],
};

export const mockDashboardRevenueDto: DashboardRevenueDto = {
  today_revenue: 24850.00,
  comparison_percentage: 12.4,
  payment_methods: [
    { method: 'CASH', amount: 10437.00, percentage: 42 },
    { method: 'INSTAPAY', amount: 8449.00, percentage: 34 },
    { method: 'VODAFONE_CASH', amount: 5964.00, percentage: 24 },
  ],
  chart_series: [
    { date: '2026-10-17', day_label: 'السبت', revenue: 14200.00 },
    { date: '2026-10-18', day_label: 'الأحد', revenue: 18500.00 },
    { date: '2026-10-19', day_label: 'الإثنين', revenue: 16800.00 },
    { date: '2026-10-20', day_label: 'الثلاثاء', revenue: 21400.00 },
    { date: '2026-10-21', day_label: 'الأربعاء', revenue: 19600.00 },
    { date: '2026-10-22', day_label: 'الخميس', revenue: 26100.00 },
    { date: '2026-10-23', day_label: 'الجمعة', revenue: 24850.00 },
  ],
  week_total: 141450.00,
  month_total: 582000.00,
  year_total: 7240000.00,
};

export const mockDashboardIssuesDto: DashboardIssueDto[] = [
  {
    id: 'issue-1',
    title: 'تسريب مياه في الحمام الرئيسي',
    issue_type: 'maintenance',
    priority: 'critical',
    reported_at: '2026-10-23T17:21:00+03:00', // ~25 min ago
    room_number: '205',
    description: 'تسريب مياه نشط في حمام الغرفة 205 يتطلب تدخل فوري',
  },
  {
    id: 'issue-2',
    title: 'طلب تنظيف عاجل (VIP)',
    issue_type: 'housekeeping',
    priority: 'high',
    reported_at: '2026-10-23T17:06:00+03:00', // ~40 min ago
    room_number: '108',
    description: 'تجهيز سريع للجناح الرئاسي لوصول ضيف مهم',
  },
  {
    id: 'issue-3',
    title: 'تأخر تسليم وردية الاستقبال',
    issue_type: 'system',
    priority: 'medium',
    reported_at: '2026-10-23T16:46:00+03:00', // ~1 hour ago
    room_number: '',
    description: 'تأخر خروج تقرير الوردية الصباحية 15 دقيقة',
  },
  {
    id: 'issue-4',
    title: 'عطل في التكييف المركزي',
    issue_type: 'maintenance',
    priority: 'high',
    reported_at: '2026-10-23T15:46:00+03:00', // ~2 hours ago
    room_number: '304',
    description: 'ضعف التبريد في الغرفة 304',
  },
];

export const mockHotelActivitiesDto: HotelActivityDto[] = [
  {
    id: 'act-1',
    title: 'تسجيل وصول ضيف VIP',
    description: 'تم تسكين الضيف في الجناح 108 وتأكيد الحجز',
    timestamp: '2026-10-23T17:36:00+03:00', // ~10 min ago
    category: 'room',
    actor_name: 'أحمد محمود',
  },
  {
    id: 'act-2',
    title: 'دفعة نقدية مسجلة',
    description: 'استلام 3,400 ج.م نقدًا مقابل إقامة الغرفة 201',
    timestamp: '2026-10-23T17:14:00+03:00', // ~32 min ago
    category: 'payment',
    actor_name: 'سارة إبراهيم',
  },
  {
    id: 'act-3',
    title: 'اكتمال تنظيف شامل',
    description: 'تم تعقيم وتجهيز الغرفة 104 وجاهزيتها للتسكين',
    timestamp: '2026-10-23T16:46:00+03:00', // ~1 hour ago
    category: 'shift',
    actor_name: 'فاطمة علي',
  },
  {
    id: 'act-4',
    title: 'إصلاح عطل كهربائي',
    description: 'صيانة مفتاح الإضاءة الرئيسي بالغرفة 309',
    timestamp: '2026-10-23T15:46:00+03:00', // ~2 hours ago
    category: 'room',
    actor_name: 'محمود حسن',
  },
];

// /shifts/overview and /staff are served by managerTeam.handlers.ts (contract v1.2 shapes),
// shared with the employees and shifts pages so every page sees the same roster.

export const managerDashboardHandlers = [
  // 1. GET /api/v1/dashboard/overview
  http.get(`${API}/dashboard/overview`, async ({ request }) => {
    if (shouldMockError(request.url)) {
      await delay(350);
      return mockErrorResponse();
    }
    await delay(350);
    return HttpResponse.json({
      data: mockDashboardOverviewDto,
    });
  }),

  // 2. GET /api/v1/dashboard/revenue
  http.get(`${API}/dashboard/revenue`, async ({ request }) => {
    if (shouldMockError(request.url)) {
      await delay(350);
      return mockErrorResponse();
    }
    await delay(350);
    const url = new URL(request.url);
    const rawDays = parseInt(url.searchParams.get('days') || '7', 10);
    const days = Math.min(90, Math.max(1, isNaN(rawDays) ? 7 : rawDays));
    const data = {
      ...mockDashboardRevenueDto,
      chart_series: (mockDashboardRevenueDto.chart_series ?? []).slice(-days),
    };
    return HttpResponse.json({
      data,
    });
  }),

  // 3. GET /api/v1/dashboard/issues
  http.get(`${API}/dashboard/issues`, async ({ request }) => {
    if (shouldMockError(request.url)) {
      await delay(350);
      return mockErrorResponse();
    }
    await delay(350);
    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '4', 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 4 : rawLimit;
    const data = mockDashboardIssuesDto.slice(0, limit);

    return HttpResponse.json({
      data,
      meta: {
        page: 1,
        limit,
        total: mockDashboardIssuesDto.length,
        total_pages: Math.ceil(mockDashboardIssuesDto.length / limit),
      },
    });
  }),

  // 4. GET /api/v1/activities
  http.get(`${API}/activities`, async ({ request }) => {
    if (shouldMockError(request.url)) {
      await delay(350);
      return mockErrorResponse();
    }
    await delay(350);
    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '4', 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 4 : rawLimit;
    const data = mockHotelActivitiesDto.slice(0, limit);

    return HttpResponse.json({
      data,
      meta: {
        page: 1,
        limit,
        total: mockHotelActivitiesDto.length,
        total_pages: Math.ceil(mockHotelActivitiesDto.length / limit),
      },
    });
  }),
];
