import { delay, http, HttpResponse } from 'msw';

// Mocks for the manager pages owned by Member C, shaped after Manager API Contract v1.2:
// /staff, /shifts, /shifts/overview, /shift-reports, /room-types.
// One in-memory store, so a change on one page shows up on the others.
// Shapes are defined here (mocks must not import feature types).

const API = '/api/v1';

type StaffType = 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPER' | 'TECHNICIAN' | 'ADMIN';
type ShiftType = 'MORNING' | 'EVENING' | 'NIGHT';
type ShiftStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
// TODO confirm with backend: the contract shows only "AVAILABLE"
type Presence = 'ON_DUTY' | 'AVAILABLE' | 'ON_BREAK';
type ReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_REVIEW';

interface MockStaff {
  staff_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  national_id: string | null;
  staff_type: StaffType;
  hire_date: string;
  is_active: boolean;
  last_login_at: string | null;
  presence: Presence | null;
  workload: { assigned_today: number; completed_today: number; open: number };
}

interface MockShift {
  shift_id: string;
  staff_id: string;
  business_date: string;
  shift_type: ShiftType;
  status: ShiftStatus;
}

interface MockReport {
  report_id: string;
  shift_id: string;
  shift_type: ShiftType;
  staff_id: string;
  staff_name: string;
  business_date: string;
  submitted_at: string;
  gross_revenue: number;
  refunds_total: number;
  cash_total: number;
  instapay_total: number;
  vodafone_cash_total: number;
  cancellation_retained_total: number;
  rooms_handled: number;
  cleaning_tasks: number;
  maintenance_requests: number;
  pending_items: number;
  review_status: ReviewStatus;
  manager_comment: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  handover_notes: string;
  follow_ups: string[];
}

interface MockRoomType {
  room_type_id: string;
  name: string;
  base_price: number;
  capacity: number;
  description: string;
  is_active: boolean;
  rooms_count: number;
  price_min: number;
  price_max: number;
  amenities: string[];
  occupancy_rate_pct: number;
  revenue_month_to_date: number;
}

const STAFF_TYPES: StaffType[] = ['MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'TECHNICIAN', 'ADMIN'];
const SHIFT_TYPES: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];
const SHIFT_HOURS: Record<ShiftType, [string, string]> = { MORNING: ['07:00', '16:00'], EVENING: ['16:00', '23:00'], NIGHT: ['23:00', '07:00'] };
// v1.2: ids are MongoDB ObjectIds sent as 24-hex strings. One prefix byte per collection keeps them unique.
const ID_KIND = { staff: '34', user: '35', shift: '31', report: '30', activity: '39', roomType: '20' } as const;
function oid(kind: keyof typeof ID_KIND, n: number): string {
  return `6719b4a1f2e8c90012${ID_KIND[kind]}${n.toString(16).padStart(4, '0')}`;
}
const CURRENT_MANAGER_ID = oid('staff', 2);

/** Today's business date in Cairo, YYYY-MM-DD */
function cairoDate(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Africa/Cairo is UTC+03:00 in this season. TODO the real API returns the right offset. */
function cairoTime(day: string, time: string): string {
  return `${day}T${time}:00+03:00`;
}

function shiftTimes(shift: { business_date: string; shift_type: ShiftType }) {
  const [start, end] = SHIFT_HOURS[shift.shift_type];
  const endDay = shift.shift_type === 'NIGHT' ? addDays(shift.business_date, 1) : shift.business_date;
  return { start_time: cairoTime(shift.business_date, start), end_time: cairoTime(endDay, end) };
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

const TODAY = cairoDate();
const YESTERDAY = addDays(TODAY, -1);

// 18 employees: 3 reception, 8 housekeeping, 4 maintenance, 2 managers and 1 admin.
// 8 are working now (presence set), 10 are not, 3 have no shift today (one housekeeper and the two managers).
const staff: MockStaff[] = [
  { staff_id: oid('staff', 8), user_id: oid('user', 31), full_name: 'أحمد سمير', email: 'ahmed.samir@alaminhotel.com', phone: '+201001234567', national_id: '29001011234567', staff_type: 'RECEPTIONIST', hire_date: '2023-02-01', is_active: true, last_login_at: hoursAgo(4.5), presence: 'ON_DUTY', workload: { assigned_today: 8, completed_today: 6, open: 2 } },
  { staff_id: oid('staff', 9), user_id: oid('user', 32), full_name: 'منى عادل', email: 'mona.adel@alaminhotel.com', phone: '+201112345678', national_id: '29203151234561', staff_type: 'RECEPTIONIST', hire_date: '2024-05-12', is_active: true, last_login_at: hoursAgo(1), presence: 'AVAILABLE', workload: { assigned_today: 5, completed_today: 0, open: 5 } },
  { staff_id: oid('staff', 11), user_id: oid('user', 34), full_name: 'سارة محمود', email: 'sara.mahmoud@alaminhotel.com', phone: '+201223456789', national_id: '29505201234562', staff_type: 'HOUSEKEEPER', hire_date: '2023-09-03', is_active: true, last_login_at: hoursAgo(5), presence: 'ON_DUTY', workload: { assigned_today: 7, completed_today: 5, open: 2 } },
  { staff_id: oid('staff', 12), user_id: oid('user', 35), full_name: 'هالة يوسف', email: 'hala.youssef@alaminhotel.com', phone: '+201534567890', national_id: '29107091234563', staff_type: 'HOUSEKEEPER', hire_date: '2022-11-20', is_active: true, last_login_at: hoursAgo(2), presence: 'ON_BREAK', workload: { assigned_today: 4, completed_today: 0, open: 4 } },
  { staff_id: oid('staff', 13), user_id: oid('user', 36), full_name: 'محمود رجب', email: 'mahmoud.ragab@alaminhotel.com', phone: '+201045678901', national_id: '28812121234564', staff_type: 'TECHNICIAN', hire_date: '2021-06-15', is_active: true, last_login_at: hoursAgo(5.2), presence: 'ON_DUTY', workload: { assigned_today: 3, completed_today: 2, open: 1 } },
  { staff_id: oid('staff', 14), user_id: oid('user', 37), full_name: 'خالد ممدوح', email: 'khaled.mamdouh@alaminhotel.com', phone: '+201156789012', national_id: '28603031234565', staff_type: 'TECHNICIAN', hire_date: '2020-01-08', is_active: true, last_login_at: hoursAgo(14), presence: null, workload: { assigned_today: 2, completed_today: 0, open: 2 } },
  { staff_id: oid('staff', 15), user_id: oid('user', 38), full_name: 'نادية فؤاد', email: 'nadia.fouad@alaminhotel.com', phone: '+201267890123', national_id: '29309181234566', staff_type: 'HOUSEKEEPER', hire_date: '2024-01-10', is_active: true, last_login_at: hoursAgo(4.8), presence: 'ON_DUTY', workload: { assigned_today: 6, completed_today: 4, open: 2 } },
  { staff_id: oid('staff', 16), user_id: oid('user', 39), full_name: 'ياسمين حسن', email: 'yasmin.hassan@alaminhotel.com', phone: '+201078901234', national_id: '29711251234568', staff_type: 'HOUSEKEEPER', hire_date: '2025-03-02', is_active: true, last_login_at: hoursAgo(4.6), presence: 'ON_DUTY', workload: { assigned_today: 5, completed_today: 3, open: 2 } },
  { staff_id: oid('staff', 17), user_id: oid('user', 40), full_name: 'عمرو شوقي', email: 'amr.shawky@alaminhotel.com', phone: '+201189012345', national_id: '29004041234569', staff_type: 'TECHNICIAN', hire_date: '2022-04-18', is_active: true, last_login_at: hoursAgo(3), presence: 'AVAILABLE', workload: { assigned_today: 2, completed_today: 1, open: 1 } },
  { staff_id: oid('staff', 10), user_id: oid('user', 33), full_name: 'كريم فتحي', email: 'karim.fathy@alaminhotel.com', phone: '+201290123456', national_id: '29408081234570', staff_type: 'RECEPTIONIST', hire_date: '2023-07-23', is_active: true, last_login_at: hoursAgo(13), presence: null, workload: { assigned_today: 4, completed_today: 0, open: 4 } },
  { staff_id: oid('staff', 18), user_id: oid('user', 41), full_name: 'إيمان صبري', email: 'eman.sabry@alaminhotel.com', phone: '+201501234598', national_id: '29602141234571', staff_type: 'HOUSEKEEPER', hire_date: '2024-08-01', is_active: true, last_login_at: hoursAgo(20), presence: null, workload: { assigned_today: 3, completed_today: 0, open: 3 } },
  { staff_id: oid('staff', 19), user_id: oid('user', 42), full_name: 'رحاب سعيد', email: 'rehab.saeed@alaminhotel.com', phone: '+201012398765', national_id: '29210261234572', staff_type: 'HOUSEKEEPER', hire_date: '2023-12-14', is_active: true, last_login_at: hoursAgo(15), presence: null, workload: { assigned_today: 2, completed_today: 0, open: 2 } },
  { staff_id: oid('staff', 20), user_id: oid('user', 43), full_name: 'ولاء جمال', email: 'walaa.gamal@alaminhotel.com', phone: '+201123987654', national_id: '29812301234573', staff_type: 'HOUSEKEEPER', hire_date: '2025-06-30', is_active: true, last_login_at: hoursAgo(16), presence: null, workload: { assigned_today: 2, completed_today: 0, open: 2 } },
  { staff_id: oid('staff', 21), user_id: oid('user', 44), full_name: 'حسن عبد الله', email: 'hassan.abdallah@alaminhotel.com', phone: '+201234876543', national_id: '28705171234574', staff_type: 'TECHNICIAN', hire_date: '2019-10-05', is_active: true, last_login_at: hoursAgo(22), presence: null, workload: { assigned_today: 1, completed_today: 0, open: 1 } },
  { staff_id: oid('staff', 22), user_id: oid('user', 45), full_name: 'شيماء طارق', email: 'shaimaa.tarek@alaminhotel.com', phone: '+201545765432', national_id: null, staff_type: 'HOUSEKEEPER', hire_date: cairoDate(), is_active: true, last_login_at: null, presence: null, workload: { assigned_today: 0, completed_today: 0, open: 0 } },
  { staff_id: oid('staff', 2), user_id: oid('user', 4), full_name: 'سارة منصور', email: 'sarah.mansour@alaminhotel.com', phone: '+201099887766', national_id: '28802021234576', staff_type: 'MANAGER', hire_date: '2024-03-01', is_active: true, last_login_at: hoursAgo(5.5), presence: null, workload: { assigned_today: 0, completed_today: 0, open: 0 } },
  { staff_id: oid('staff', 23), user_id: oid('user', 46), full_name: 'دينا رأفت', email: 'dina.raafat@alaminhotel.com', phone: '+201167543210', national_id: '29406131234577', staff_type: 'MANAGER', hire_date: '2022-02-14', is_active: true, last_login_at: hoursAgo(96), presence: null, workload: { assigned_today: 0, completed_today: 0, open: 0 } },
  { staff_id: oid('staff', 24), user_id: oid('user', 47), full_name: 'طارق نبيل', email: 'tarek.nabil@alaminhotel.com', phone: '+201278432109', national_id: '28811051234578', staff_type: 'ADMIN', hire_date: '2018-09-01', is_active: true, last_login_at: hoursAgo(19), presence: null, workload: { assigned_today: 1, completed_today: 0, open: 1 } },
];

let nextStaffId = 30;
let nextUserId = 60;
let nextShiftId = 200;

// Today's roster: morning is running, evening and night are still ahead
const shifts: MockShift[] = [
  ...[8, 11, 13, 15, 16, 17].map((id) => ({ staff_id: oid('staff', id), shift_type: 'MORNING' as const, status: 'ACTIVE' as const })),
  ...[9, 12, 18, 21, 24].map((id) => ({ staff_id: oid('staff', id), shift_type: 'EVENING' as const, status: 'SCHEDULED' as const })),
  ...[10, 14, 19, 20].map((id) => ({ staff_id: oid('staff', id), shift_type: 'NIGHT' as const, status: 'SCHEDULED' as const })),
].map((item, index) => ({ ...item, shift_id: oid('shift', 142 + index), business_date: TODAY }));

const shiftStats: Record<ShiftType, { rooms_handled: number; gross_revenue: number; cleaning_tasks: number; maintenance_requests: number; pending_items: number }> = {
  MORNING: { rooms_handled: 14, gross_revenue: 9250, cleaning_tasks: 8, maintenance_requests: 1, pending_items: 2 },
  EVENING: { rooms_handled: 12, gross_revenue: 11400, cleaning_tasks: 6, maintenance_requests: 2, pending_items: 3 },
  NIGHT: { rooms_handled: 10, gross_revenue: 4200, cleaning_tasks: 4, maintenance_requests: 3, pending_items: 4 },
};

// Yesterday's submitted end-of-shift reports
const reports: MockReport[] = [
  { report_id: oid('report', 44), shift_id: oid('shift', 120), shift_type: 'MORNING', staff_id: oid('staff', 8), staff_name: 'أحمد سمير', business_date: YESTERDAY, submitted_at: cairoTime(YESTERDAY, '15:52'), gross_revenue: 9250, refunds_total: 0, cancellation_retained_total: 0, cash_total: 4200, instapay_total: 3500, vodafone_cash_total: 1550, rooms_handled: 14, cleaning_tasks: 8, maintenance_requests: 1, pending_items: 2, review_status: 'PENDING_REVIEW', manager_comment: null, reviewed_by_staff_id: null, reviewed_at: null, handover_notes: 'تم تسليم مفاتيح الغرف ١٠٤ و٢٠٧ للوردية التالية، وغرفة ٣١٢ بانتظار فني التكييف.', follow_ups: ['متابعة فني التكييف لغرفة ٣١٢', 'شنطة ضيف غرفة ٢٠٥ في مخزن الأمانات'] },
  { report_id: oid('report', 45), shift_id: oid('shift', 121), shift_type: 'EVENING', staff_id: oid('staff', 9), staff_name: 'منى عادل', business_date: YESTERDAY, submitted_at: cairoTime(YESTERDAY, '22:47'), gross_revenue: 11400, refunds_total: 700, cancellation_retained_total: 300, cash_total: 6900, instapay_total: 3000, vodafone_cash_total: 1500, rooms_handled: 12, cleaning_tasks: 7, maintenance_requests: 2, pending_items: 3, review_status: 'PENDING_REVIEW', manager_comment: null, reviewed_by_staff_id: null, reviewed_at: null, handover_notes: 'وصول متأخر لضيفين في الغرف ٢٠١ و٢٠٢، والدفع نقدًا عند الوصول.', follow_ups: ['تحصيل باقي حساب غرفة ٢٠٢'] },
  { report_id: oid('report', 46), shift_id: oid('shift', 122), shift_type: 'NIGHT', staff_id: oid('staff', 10), staff_name: 'كريم فتحي', business_date: YESTERDAY, submitted_at: cairoTime(TODAY, '06:55'), gross_revenue: 4200, refunds_total: 0, cancellation_retained_total: 0, cash_total: 3100, instapay_total: 800, vodafone_cash_total: 300, rooms_handled: 10, cleaning_tasks: 6, maintenance_requests: 3, pending_items: 4, review_status: 'APPROVED', manager_comment: 'تم عدّ الدرج ومطابقته.', reviewed_by_staff_id: CURRENT_MANAGER_ID, reviewed_at: cairoTime(TODAY, '08:10'), handover_notes: 'وردية هادئة، تم تسجيل ثلاثة بلاغات صيانة بسيطة.', follow_ups: [] },
];

const reportActivities: Record<string, Array<{ activity_id: string; event_type: string; description: string; amount?: number; timestamp: string }>> = {
  [oid('report', 44)]: [
    { activity_id: oid('activity', 901 - 900), event_type: 'PAYMENT', description: 'دفعة نقدية لغرفة ١٠٢', amount: 1200, timestamp: cairoTime(YESTERDAY, '09:15') },
    { activity_id: oid('activity', 902 - 900), event_type: 'CHECK_IN', description: 'تسجيل وصول غرفة ٢٠٥', timestamp: cairoTime(YESTERDAY, '12:30') },
    { activity_id: oid('activity', 903 - 900), event_type: 'PAYMENT', description: 'دفعة إنستاباي لغرفة ٣٠١', amount: 3500, timestamp: cairoTime(YESTERDAY, '14:05') },
  ],
  [oid('report', 45)]: [
    { activity_id: oid('activity', 911 - 900), event_type: 'CHECK_IN', description: 'تسجيل وصول غرفة ٢٠١', timestamp: cairoTime(YESTERDAY, '20:40') },
    { activity_id: oid('activity', 912 - 900), event_type: 'REFUND', description: 'استرداد إلغاء حجز غرفة ١٠٧ (محتجز ٣٠٠ ج.م)', amount: 700, timestamp: cairoTime(YESTERDAY, '21:10') },
  ],
  [oid('report', 46)]: [
    { activity_id: oid('activity', 921 - 900), event_type: 'MAINTENANCE', description: 'بلاغ تسريب مياه غرفة ٢٠٥', timestamp: cairoTime(TODAY, '02:20') },
  ],
};

const roomTypes: MockRoomType[] = [
  { room_type_id: oid('roomType', 1), name: 'Standard', base_price: 300, capacity: 2, description: 'غرفة مزدوجة بإطلالة على الشارع', is_active: true, rooms_count: 21, price_min: 250, price_max: 350, amenities: ['Street view', 'Twin beds', 'Fan'], occupancy_rate_pct: 67, revenue_month_to_date: 286000 },
  { room_type_id: oid('roomType', 2), name: 'VIP', base_price: 850, capacity: 3, description: 'جناح مميز بخدمات إضافية', is_active: true, rooms_count: 15, price_min: 700, price_max: 1000, amenities: ['Air conditioning', 'Fridge', 'Private bathroom'], occupancy_rate_pct: 76, revenue_month_to_date: 398000 },
];

function errorResponse(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return HttpResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

function maskId(value: string | null): string | null {
  return value ? `******${value.slice(-4)}` : null;
}

function todayShiftOf(staffId: string) {
  return shifts.find((shift) => shift.staff_id === staffId && shift.business_date === TODAY && shift.status !== 'CANCELLED') ?? null;
}

function staffView(member: MockStaff, include: string[]) {
  const { presence, workload, ...rest } = member;
  const shift = todayShiftOf(member.staff_id);
  return {
    ...rest,
    national_id: maskId(member.national_id),
    ...(include.includes('today_shift')
      ? { today_shift: shift ? { shift_id: shift.shift_id, shift_type: shift.shift_type, status: shift.status, presence: shift.status === 'ACTIVE' || presence ? presence : null } : null }
      : {}),
    ...(include.includes('workload') ? { workload } : {}),
  };
}

function shiftView(shift: MockShift) {
  const member = staff.find((item) => item.staff_id === shift.staff_id);
  return { ...shift, staff_name: member?.full_name ?? '', ...shiftTimes(shift) };
}

function listMeta(total: number, page: number, limit: number) {
  return { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) };
}

function pageParams(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
  return { page, limit };
}

function paged<T>(items: T[], url: URL) {
  const { page, limit } = pageParams(url);
  return { data: items.slice((page - 1) * limit, page * limit), meta: listMeta(items.length, page, limit) };
}

function isText(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

const PHONE = /^\+201[0125]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NATIONAL_ID = /^[23]\d{13}$/;

function makePassword(): string {
  const words = ['delta', 'harvest', 'blue', 'falcon', 'river', 'cedar', 'amber', 'nile', 'stone', 'lotus'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}-${Math.floor(10 + Math.random() * 89)}`;
}

function reportView(report: MockReport) {
  const { handover_notes: _notes, follow_ups: _follow, submitted_at: _submitted, ...rest } = report;
  void _notes; void _follow; void _submitted;
  // v1.2 §9: net = gross − refunds; the retained part of a cancellation is already inside gross
  return { ...rest, net_revenue: report.gross_revenue - report.refunds_total, pdf_url: null };
}

export const managerTeamHandlers = [
  // ---------- Staff (contract §6) ----------
  http.get(`${API}/staff`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const include = (url.searchParams.get('include') ?? '').split(',').map((item) => item.trim());
    const type = url.searchParams.get('staff_type');
    const active = url.searchParams.get('is_active');
    const onShift = url.searchParams.get('on_shift');
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
    const list = staff
      .filter((member) => !type || member.staff_type === type)
      .filter((member) => active === null || String(member.is_active) === active)
      .filter((member) => onShift !== 'true' || Boolean(member.presence))
      .filter((member) => !search || member.full_name.toLowerCase().includes(search) || member.email.includes(search))
      .map((member) => staffView(member, include));
    return HttpResponse.json(paged(list, url));
  }),

  http.post(`${API}/staff`, async ({ request }) => {
    await delay(300);
    if (!request.headers.get('Idempotency-Key')) return errorResponse('VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
    const body = (await request.json()) as Record<string, unknown>;
    if (!isText(body.full_name, 80)) return errorResponse('VALIDATION_ERROR', 'Invalid full_name', 400, { field: 'full_name' });
    if (typeof body.email !== 'string' || !EMAIL.test(body.email)) return errorResponse('VALIDATION_ERROR', 'Invalid email', 400, { field: 'email' });
    if (typeof body.phone !== 'string' || !PHONE.test(body.phone)) return errorResponse('VALIDATION_ERROR', 'Invalid phone', 400, { field: 'phone' });
    if (!STAFF_TYPES.includes(body.staff_type as StaffType)) return errorResponse('VALIDATION_ERROR', 'Invalid staff_type', 400, { field: 'staff_type' });
    if (typeof body.hire_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.hire_date)) return errorResponse('VALIDATION_ERROR', 'Invalid hire_date', 400, { field: 'hire_date' });
    if (body.national_id != null && (typeof body.national_id !== 'string' || !NATIONAL_ID.test(body.national_id))) {
      return errorResponse('VALIDATION_ERROR', 'Invalid national_id', 400, { field: 'national_id' });
    }
    const email = body.email.trim().toLowerCase();
    if (staff.some((member) => member.is_active && member.email === email)) return errorResponse('CONFLICT', 'Email already in use', 409, { field: 'email' });
    if (body.national_id && staff.some((member) => member.national_id === body.national_id)) return errorResponse('CONFLICT', 'National ID already registered', 409, { field: 'national_id' });
    const member: MockStaff = {
      staff_id: oid('staff', nextStaffId++),
      user_id: oid('user', nextUserId++),
      full_name: body.full_name.trim().replace(/\s+/g, ' '),
      email,
      phone: body.phone,
      national_id: (body.national_id as string | undefined) ?? null,
      staff_type: body.staff_type as StaffType,
      hire_date: body.hire_date,
      is_active: true,
      last_login_at: null,
      presence: null,
      workload: { assigned_today: 0, completed_today: 0, open: 0 },
    };
    staff.push(member);
    return HttpResponse.json({ data: { ...staffView(member, []), role: member.staff_type === 'ADMIN' ? 'ADMIN' : 'STAFF', temporary_password: makePassword() } }, { status: 201 });
  }),

  http.get(`${API}/staff/:id`, async ({ params }) => {
    await delay(200);
    const member = staff.find((item) => item.staff_id === String(params.id));
    if (!member) return errorResponse('NOT_FOUND', 'Staff not found', 404);
    return HttpResponse.json({ data: staffView(member, ['today_shift', 'workload']) });
  }),

  http.patch(`${API}/staff/:id`, async ({ params, request }) => {
    await delay(300);
    const member = staff.find((item) => item.staff_id === String(params.id));
    if (!member) return errorResponse('NOT_FOUND', 'Staff not found', 404);
    const body = (await request.json()) as Record<string, unknown>;
    if (body.full_name !== undefined && !isText(body.full_name, 80)) return errorResponse('VALIDATION_ERROR', 'Invalid full_name', 400, { field: 'full_name' });
    if (body.phone !== undefined && (typeof body.phone !== 'string' || !PHONE.test(body.phone))) return errorResponse('VALIDATION_ERROR', 'Invalid phone', 400, { field: 'phone' });
    if (body.email !== undefined && (typeof body.email !== 'string' || !EMAIL.test(body.email))) return errorResponse('VALIDATION_ERROR', 'Invalid email', 400, { field: 'email' });
    if (body.staff_type !== undefined && !STAFF_TYPES.includes(body.staff_type as StaffType)) return errorResponse('VALIDATION_ERROR', 'Invalid staff_type', 400, { field: 'staff_type' });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : member.email;
    if (staff.some((item) => item.staff_id !== member.staff_id && item.is_active && item.email === email)) {
      return errorResponse('CONFLICT', 'Email already in use', 409, { field: 'email' });
    }
    Object.assign(member, {
      full_name: typeof body.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : member.full_name,
      phone: (body.phone as string | undefined) ?? member.phone,
      email,
      staff_type: (body.staff_type as StaffType | undefined) ?? member.staff_type,
      is_active: body.is_active === true ? true : member.is_active,
    });
    return HttpResponse.json({ data: staffView(member, ['today_shift', 'workload']) });
  }),

  http.delete(`${API}/staff/:id`, async ({ params }) => {
    await delay(300);
    const member = staff.find((item) => item.staff_id === String(params.id));
    if (!member) return errorResponse('NOT_FOUND', 'Staff not found', 404);
    if (member.staff_id === CURRENT_MANAGER_ID) return errorResponse('FORBIDDEN', 'You cannot deactivate your own account', 403);
    member.is_active = false;
    member.presence = null;
    return HttpResponse.json({ data: staffView(member, ['today_shift', 'workload']) });
  }),

  http.post(`${API}/staff/:id/reactivate`, async ({ params }) => {
    await delay(300);
    const member = staff.find((item) => item.staff_id === String(params.id));
    if (!member) return errorResponse('NOT_FOUND', 'Staff not found', 404);
    if (member.is_active) return errorResponse('INVALID_STATUS_TRANSITION', 'Already active', 422);
    member.is_active = true;
    return HttpResponse.json({ data: staffView(member, ['today_shift', 'workload']) });
  }),

  http.post(`${API}/staff/:id/reset-password`, async ({ params }) => {
    await delay(300);
    const member = staff.find((item) => item.staff_id === String(params.id));
    if (!member) return errorResponse('NOT_FOUND', 'Staff not found', 404);
    if (!member.is_active) return errorResponse('INVALID_STATUS_TRANSITION', 'Account is deactivated', 422);
    return HttpResponse.json({ data: { staff_id: member.staff_id, temporary_password: makePassword() } });
  }),

  // ---------- Shifts (contract §7) ----------
  http.get(`${API}/shifts/overview`, async ({ request }) => {
    await delay(250);
    const day = new URL(request.url).searchParams.get('business_date') ?? TODAY;
    const data = SHIFT_TYPES.map((type) => {
      const team = shifts.filter((shift) => shift.business_date === day && shift.shift_type === type && shift.status !== 'CANCELLED');
      const lead = team.map((shift) => staff.find((member) => member.staff_id === shift.staff_id)).find((member) => member?.staff_type === 'RECEPTIONIST');
      const leadShift = team.find((shift) => shift.staff_id === lead?.staff_id) ?? team[0];
      const report = reports.find((item) => item.business_date === day && item.shift_type === type);
      return {
        shift_type: type,
        shift_id: leadShift?.shift_id ?? null,
        status: team.some((shift) => shift.status === 'ACTIVE') ? 'ACTIVE' : leadShift?.status ?? 'SCHEDULED',
        ...shiftTimes({ business_date: day, shift_type: type }),
        staff: lead ? { staff_id: lead.staff_id, full_name: lead.full_name } : null,
        team_count: team.length,
        ...(day === TODAY ? shiftStats[type] : { rooms_handled: 0, gross_revenue: 0, cleaning_tasks: 0, maintenance_requests: 0, pending_items: 0 }),
        report: report ? { report_id: report.report_id, review_status: report.review_status } : null,
      };
    });
    return HttpResponse.json({ data });
  }),

  http.get(`${API}/shifts`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const day = url.searchParams.get('business_date');
    const type = url.searchParams.get('shift_type');
    const staffId = url.searchParams.get('staff_id');
    const list = shifts
      .filter((shift) => shift.status !== 'CANCELLED')
      .filter((shift) => !day || shift.business_date === day)
      .filter((shift) => !type || shift.shift_type === type)
      .filter((shift) => !staffId || shift.staff_id === staffId)
      .map(shiftView);
    return HttpResponse.json(paged(list, url));
  }),

  http.post(`${API}/shifts`, async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { staff_id?: string; business_date?: string; shift_type?: ShiftType };
    const member = staff.find((item) => item.staff_id === body.staff_id);
    if (!member || !member.is_active) return errorResponse('VALIDATION_ERROR', 'Invalid staff_id', 400, { field: 'staff_id' });
    if (!SHIFT_TYPES.includes(body.shift_type as ShiftType)) return errorResponse('VALIDATION_ERROR', 'Invalid shift_type', 400, { field: 'shift_type' });
    const day = body.business_date ?? TODAY;
    if (shifts.some((shift) => shift.staff_id === member.staff_id && shift.business_date === day && shift.status !== 'CANCELLED')) {
      return errorResponse('SHIFT_OVERLAP', 'Staff member already has a shift that day', 409);
    }
    const shift: MockShift = { shift_id: oid('shift', nextShiftId++), staff_id: member.staff_id, business_date: day, shift_type: body.shift_type as ShiftType, status: 'SCHEDULED' };
    shifts.push(shift);
    return HttpResponse.json({ data: shiftView(shift) }, { status: 201 });
  }),

  http.patch(`${API}/shifts/:id`, async ({ params, request }) => {
    await delay(300);
    const shift = shifts.find((item) => item.shift_id === String(params.id));
    if (!shift || shift.status === 'CANCELLED') return errorResponse('NOT_FOUND', 'Shift not found', 404);
    if (shift.status !== 'SCHEDULED') return errorResponse('SHIFT_ALREADY_STARTED', 'Shift already started', 409);
    const body = (await request.json()) as { shift_type?: ShiftType; staff_id?: string };
    if (body.shift_type !== undefined && !SHIFT_TYPES.includes(body.shift_type)) return errorResponse('VALIDATION_ERROR', 'Invalid shift_type', 400);
    Object.assign(shift, { shift_type: body.shift_type ?? shift.shift_type, staff_id: body.staff_id ?? shift.staff_id });
    return HttpResponse.json({ data: shiftView(shift) });
  }),

  http.delete(`${API}/shifts/:id`, async ({ params }) => {
    await delay(300);
    const shift = shifts.find((item) => item.shift_id === String(params.id));
    if (!shift || shift.status === 'CANCELLED') return errorResponse('NOT_FOUND', 'Shift not found', 404);
    if (shift.status !== 'SCHEDULED') return errorResponse('SHIFT_ALREADY_STARTED', 'Shift already started', 409);
    shift.status = 'CANCELLED';
    return HttpResponse.json({ data: shiftView(shift) });
  }),

  // ---------- Shift reports (contract §9) ----------
  http.get(`${API}/shift-reports`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const status = url.searchParams.get('review_status');
    const day = url.searchParams.get('business_date');
    const shiftId = url.searchParams.get('shift_id');
    const list = reports
      .filter((report) => !status || report.review_status === status)
      .filter((report) => !day || report.business_date === day)
      .filter((report) => !shiftId || report.shift_id === shiftId)
      .map(reportView);
    return HttpResponse.json(paged(list, url));
  }),

  http.get(`${API}/shift-reports/:id/handover`, async ({ params }) => {
    await delay(200);
    const report = reports.find((item) => item.report_id === String(params.id));
    if (!report) return errorResponse('NOT_FOUND', 'Report not found', 404);
    return HttpResponse.json({ data: { report_id: report.report_id, notes: report.handover_notes, follow_ups: report.follow_ups, pending_luggage: [] } });
  }),

  http.get(`${API}/shift-reports/:id/activities`, async ({ params }) => {
    await delay(200);
    return HttpResponse.json({ data: reportActivities[String(params.id)] ?? [] });
  }),

  http.get(`${API}/shift-reports/:id`, async ({ params }) => {
    await delay(200);
    const report = reports.find((item) => item.report_id === String(params.id));
    if (!report) return errorResponse('NOT_FOUND', 'Report not found', 404);
    return HttpResponse.json({ data: { ...reportView(report), submitted_at: report.submitted_at } });
  }),

  http.patch(`${API}/shift-reports/:id/review`, async ({ params, request }) => {
    await delay(300);
    const report = reports.find((item) => item.report_id === String(params.id));
    if (!report) return errorResponse('NOT_FOUND', 'Report not found', 404);
    const body = (await request.json()) as { review_status?: string; manager_comment?: string };
    if (body.review_status !== 'APPROVED' && body.review_status !== 'NEEDS_REVIEW') return errorResponse('VALIDATION_ERROR', 'Invalid review_status', 400);
    if (body.review_status === 'NEEDS_REVIEW' && !isText(body.manager_comment, 500)) return errorResponse('VALIDATION_ERROR', 'manager_comment is required', 400, { field: 'manager_comment' });
    if (report.review_status === 'APPROVED') return errorResponse('RECORD_ALREADY_DECIDED', 'Report already approved', 409);
    Object.assign(report, {
      review_status: body.review_status,
      manager_comment: body.manager_comment?.trim() || null,
      reviewed_by_staff_id: CURRENT_MANAGER_ID,
      reviewed_at: new Date().toISOString(),
    });
    return HttpResponse.json({ data: reportView(report) });
  }),

  // ---------- Room types (contract §11.1) ----------
  http.get(`${API}/room-types`, async () => {
    await delay(250);
    return HttpResponse.json({ data: roomTypes.filter((type) => type.is_active) });
  }),

  http.patch(`${API}/room-types/:id`, async ({ params, request }) => {
    await delay(300);
    const type = roomTypes.find((item) => item.room_type_id === String(params.id));
    if (!type) return errorResponse('NOT_FOUND', 'Room type not found', 404);
    const body = (await request.json()) as { base_price?: number; capacity?: number; description?: string; amenities?: unknown };
    if (body.base_price !== undefined && (!Number.isFinite(body.base_price) || body.base_price <= 0)) {
      return errorResponse('VALIDATION_ERROR', 'base_price must be > 0', 400, { field: 'base_price', issue: '> 0' });
    }
    if (body.capacity !== undefined && (!Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 10)) {
      return errorResponse('VALIDATION_ERROR', 'Invalid capacity', 400, { field: 'capacity' });
    }
    if (body.amenities !== undefined && (!Array.isArray(body.amenities) || body.amenities.some((item) => !isText(item, 40)))) {
      return errorResponse('VALIDATION_ERROR', 'Invalid amenities', 400, { field: 'amenities' });
    }
    Object.assign(type, {
      base_price: body.base_price ?? type.base_price,
      capacity: body.capacity ?? type.capacity,
      description: body.description !== undefined ? String(body.description).trim() : type.description,
      amenities: Array.isArray(body.amenities) ? body.amenities.map((item: string) => item.trim()) : type.amenities,
    });
    return HttpResponse.json({ data: type });
  }),
];
