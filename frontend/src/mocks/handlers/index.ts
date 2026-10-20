import { http, HttpResponse } from 'msw';
import type { RoomStatus } from '../../types/common.types';

// شكل الغرفة كما يرجعه الـ API (معرّف هنا عشان الـ mocks ماتعتمدش على types الـ features)
interface Room {
  room_id: number;
  room_type: string;
  status: RoomStatus;
  description: string;
  price_per_night: number;
  half_day_price: number;
}
import type {
  CleaningTask,
  MaintenanceIssue,
  Payment,
} from '../../features/shift-handover/types/shift-handover.types';

const API = '/api/v1';

export const mockHandlers = {
  dashboard: '/dashboard',
  rooms: '/rooms',
  housekeeping: '/cleaning-tasks',
  maintenance: '/maintenance-issues',
  payments: '/payments',
  shiftHandover: '/shifts/current/handover',
  shiftSummary: '/shifts/current/summary',
  shiftReport: '/shifts/:shift_id/report',
} as const;

const now = '2026-10-09T08:00:00+03:00';

const mockShift = {
  shift_id: 41,
  staff_id: 1,
  shift_date: '2026-10-09',
  shift_type: 'morning',
  start_time: '07:00',
  end_time: '16:00',
  status: 'active' as 'active' | 'handed_over',
  handed_over_at: null as string | null,
  shift_notes: null as string | null,
};

const rooms: Room[] = [
  {
    room_id: 101,
    room_type: 'single',
    status: 'available',
    description: 'Single room',
    price_per_night: 1200,
    half_day_price: 600,
  },
  {
    room_id: 102,
    room_type: 'double',
    status: 'occupied',
    description: 'Double room',
    price_per_night: 1800,
    half_day_price: 900,
  },
  {
    room_id: 103,
    room_type: 'double',
    status: 'cleaning',
    description: 'Double room',
    price_per_night: 1800,
    half_day_price: 900,
  },
];

const cleaningTasks: CleaningTask[] = [
  {
    task_id: 1,
    room_id: 103,
    priority: 'medium',
    status: 'pending',
    notes: 'Clean room after checkout',
    cleaner_name: 'Demo Cleaner',
    assigned_date: now,
    finished_date: null,
    shift_id: 41,
    assigned_by_staff_id: 1,
  },
];

const maintenanceIssues: MaintenanceIssue[] = [
  {
    issue_id: 1,
    room_id: 102,
    problem: 'Air conditioning inspection',
    priority: 'medium',
    status: 'open',
    notes: null,
    created_date: now,
    resolved_date: null,
    shift_id: 41,
    staff_id: 1,
  },
];

const payments: Payment[] = [
  {
    payment_id: 900,
    reservation_id: 55,
    staff_id: 1,
    shift_id: 41,
    amount: 1500,
    payment_method: 'cash',
    notes: 'Demo payment',
    payment_datetime: now,
    payment_verified: false,
    reversal_of_payment_id: null,
  },
];

let shiftNotes: string | null = null;

function paginate<T>(items: T[], request: Request) {
  const url = new URL(request.url);
  const page = Math.max(
    1,
    Number(url.searchParams.get('page')) || 1,
  );
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('limit')) || 20),
  );
  const start = (page - 1) * limit;

  return {
    data: items.slice(start, start + limit),
    meta: {
      page,
      limit,
      total: items.length,
    },
  };
}

function errorResponse(
  code: string,
  message: string,
  status: number,
) {
  return HttpResponse.json(
    { error: { code, message } },
    { status },
  );
}

function paymentTotals() {
  const cash = payments
    .filter((p) => p.payment_method === 'cash')
    .reduce((sum, p) => sum + p.amount, 0);

  const instapay = payments
    .filter((p) => p.payment_method === 'instapay')
    .reduce((sum, p) => sum + p.amount, 0);

  const vodafoneCash = payments
    .filter((p) => p.payment_method === 'vodafone_cash')
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    cash,
    instapay,
    vodafone_cash: vodafoneCash,
    total: cash + instapay + vodafoneCash,
  };
}

function roomsByStatus() {
  const counts: Record<Room['status'], number> = {
    available: 0,
    reserved: 0,
    occupied: 0,
    cleaning: 0,
    maintenance: 0,
  };
  rooms.forEach((room) => {
    counts[room.status] += 1;
  });
  return counts;
}

// ================= mocks الكتابة وحالة read_only =================
// لتفعيل read_only: اعملي ملف .env.local فيه VITE_MOCK_READ_ONLY=true وأعيدي تشغيل npm run dev
const READ_ONLY = import.meta.env.VITE_MOCK_READ_ONLY === 'true';

let nextId = 1000;
const newId = () => nextId++;

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PAYMENT_METHODS = ['cash', 'instapay', 'vodafone_cash'];

// الحجز التجريبي رقم 55: إجماليه 4500 (السيرفر هو اللي بيحسب الإجمالي، مش العميل)
const RESERVATION_TOTALS: Record<number, number> = { 55: 4500 };

function reservationTotals(reservationId: number) {
  const total = RESERVATION_TOTALS[reservationId];
  if (total === undefined) return null;
  const paid = payments
    .filter((p) => p.reservation_id === reservationId)
    .reduce((sum, p) => sum + p.amount, 0);
  return {
    total_amount: total,
    paid_amount: Math.round(paid * 100) / 100,
    remaining_amount: Math.round((total - paid) * 100) / 100,
  };
}

// أي كتابة: 403 في جلسة القراءة فقط، و409 بعد التسليم
function guardWrite() {
  if (READ_ONLY) {
    return errorResponse(
      'FORBIDDEN',
      'This session is read-only until your shift starts.',
      403,
    );
  }
  if (mockShift.status === 'handed_over') {
    return errorResponse(
      'SHIFT_CLOSED',
      'This shift was already handed over.',
      409,
    );
  }
  return null;
}

const ROOM_TRANSITIONS: Record<string, string[]> = {
  available: ['cleaning', 'maintenance'],
  reserved: [],
  occupied: [],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
};

const roomHistory: Array<{
  history_id: number;
  room_id: number;
  status: string;
  notes: string | null;
  changed_at: string;
  shift_id: number;
}> = [];

const idempotencyStore = new Map<
  string,
  { bodyText: string; status: number; payload: Record<string, unknown> }
>();

type PaymentBody = {
  reservation_id?: number;
  room_id?: string | number;
  amount?: number;
  payment_method?: string;
  notes?: string;
};

const writeHandlers = [
  // ---- read_only: لو مفعّلة، الاستجابات دي بتحل محل العادية. لو لأ، بنكمّل للـ handler اللي بعدها ----
  http.post(`${API}/auth/login`, () => {
    if (READ_ONLY) {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        expires_in: 900,
        staff: {
          staff_id: 1,
          name: 'Demo Receptionist',
          default_shift_type: 'morning',
        },
        shift: null,
        read_only: true,
      });
    }
    return undefined;
  }),

  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({
      staff: {
        staff_id: 1,
        name: 'Demo Receptionist',
        default_shift_type: 'morning',
      },
      shift: READ_ONLY ? null : { ...mockShift },
      read_only: READ_ONLY,
    }),
  ),

  http.get(`${API}/shifts/current`, () => {
    if (READ_ONLY) {
      return errorResponse('NOT_FOUND', 'No active shift.', 404);
    }
    return undefined;
  }),

  http.get(`${API}/shifts/current/summary`, () => {
    if (READ_ONLY) {
      return errorResponse('NOT_FOUND', 'No active shift.', 404);
    }
    return undefined;
  }),

  http.patch(`${API}/shifts/current/handover`, () => {
    if (READ_ONLY) {
      return errorResponse(
        'FORBIDDEN',
        'This session is read-only until your shift starts.',
        403,
      );
    }
    return undefined;
  }),

  // ---- الغرف ----
  http.patch(`${API}/rooms/:room_id/status`, async ({ params, request }) => {
    const blocked = guardWrite();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      notes?: string;
    };

    if (
      !body.status ||
      !['available', 'cleaning', 'maintenance'].includes(body.status)
    ) {
      return errorResponse(
        'VALIDATION_ERROR',
        'status must be available, cleaning or maintenance.',
        400,
      );
    }

    const room = rooms.find((r) => r.room_id === Number(params.room_id));
    if (!room) return errorResponse('NOT_FOUND', 'Room not found.', 404);

    if (!ROOM_TRANSITIONS[room.status].includes(body.status)) {
      return errorResponse(
        'INVALID_STATUS_TRANSITION',
        `A room in '${room.status}' status cannot be changed to '${body.status}'.`,
        409,
      );
    }

    room.status = body.status as Room['status'];
    const row = {
      history_id: newId(),
      room_id: room.room_id,
      status: room.status,
      notes: body.notes ?? null,
      changed_at: now,
      shift_id: mockShift.shift_id,
    };
    roomHistory.push(row);
    return HttpResponse.json(row);
  }),

  http.get(`${API}/rooms/:room_id/status-history`, ({ params, request }) => {
    const items = roomHistory
      .filter((h) => h.room_id === Number(params.room_id))
      .reverse();
    return HttpResponse.json(paginate(items, request));
  }),

  // ---- مهام التنظيف ----
  http.post(`${API}/cleaning-tasks`, async ({ request }) => {
    const blocked = guardWrite();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      room_id?: number;
      priority?: string;
      cleaner_name?: string;
      notes?: string;
    };

    if (!body.room_id || !body.priority || !PRIORITIES.includes(body.priority)) {
      return errorResponse(
        'VALIDATION_ERROR',
        'room_id and a valid priority are required.',
        400,
      );
    }
    if (!rooms.some((r) => r.room_id === body.room_id)) {
      return errorResponse('NOT_FOUND', 'Room not found.', 404);
    }

    const task: CleaningTask = {
      task_id: newId(),
      room_id: body.room_id,
      priority: body.priority as CleaningTask['priority'],
      status: 'pending',
      notes: body.notes ?? null,
      cleaner_name: body.cleaner_name ?? null,
      assigned_date: now,
      finished_date: null,
      shift_id: mockShift.shift_id,
      assigned_by_staff_id: 1,
    };
    cleaningTasks.push(task);
    return HttpResponse.json(task, { status: 201 });
  }),

  http.get(`${API}/cleaning-tasks/:task_id`, ({ params }) => {
    const task = cleaningTasks.find((t) => t.task_id === Number(params.task_id));
    if (!task) return errorResponse('NOT_FOUND', 'Task not found.', 404);
    return HttpResponse.json(task);
  }),

  http.patch(`${API}/cleaning-tasks/:task_id`, async ({ params, request }) => {
    const blocked = guardWrite();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      cleaner_name?: string;
      priority?: string;
      notes?: string;
      status?: string;
    };

    if (
      Object.keys(body).length === 0 ||
      (body.status !== undefined && body.status !== 'done') ||
      (body.priority !== undefined && !PRIORITIES.includes(body.priority))
    ) {
      return errorResponse('VALIDATION_ERROR', 'Invalid update.', 400);
    }

    const task = cleaningTasks.find((t) => t.task_id === Number(params.task_id));
    if (!task) return errorResponse('NOT_FOUND', 'Task not found.', 404);

    if (body.cleaner_name !== undefined) task.cleaner_name = body.cleaner_name;
    if (body.priority !== undefined) {
      task.priority = body.priority as CleaningTask['priority'];
    }
    if (body.notes !== undefined) task.notes = body.notes;
    if (body.status === 'done') {
      task.status = 'done';
      task.finished_date = now;
    }
    return HttpResponse.json(task);
  }),

  // ---- مشاكل الصيانة ----
  http.post(`${API}/maintenance-issues`, async ({ request }) => {
    const blocked = guardWrite();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      room_id?: number;
      problem?: string;
      priority?: string;
      notes?: string;
    };

    if (
      !body.room_id ||
      !body.problem?.trim() ||
      !body.priority ||
      !PRIORITIES.includes(body.priority)
    ) {
      return errorResponse(
        'VALIDATION_ERROR',
        'room_id, problem and a valid priority are required.',
        400,
      );
    }
    if (!rooms.some((r) => r.room_id === body.room_id)) {
      return errorResponse('NOT_FOUND', 'Room not found.', 404);
    }

    const issue: MaintenanceIssue = {
      issue_id: newId(),
      room_id: body.room_id,
      problem: body.problem,
      priority: body.priority as MaintenanceIssue['priority'],
      status: 'open',
      notes: body.notes ?? null,
      created_date: now,
      resolved_date: null,
      shift_id: mockShift.shift_id,
      staff_id: 1,
    };
    maintenanceIssues.push(issue);
    return HttpResponse.json(issue, { status: 201 });
  }),

  http.get(`${API}/maintenance-issues/:issue_id`, ({ params }) => {
    const issue = maintenanceIssues.find(
      (i) => i.issue_id === Number(params.issue_id),
    );
    if (!issue) return errorResponse('NOT_FOUND', 'Issue not found.', 404);
    return HttpResponse.json(issue);
  }),

  http.patch(`${API}/maintenance-issues/:issue_id`, async ({ params, request }) => {
    const blocked = guardWrite();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      priority?: string;
      notes?: string;
      status?: string;
    };

    if (
      Object.keys(body).length === 0 ||
      (body.status !== undefined &&
        !['in_progress', 'resolved'].includes(body.status)) ||
      (body.priority !== undefined && !PRIORITIES.includes(body.priority))
    ) {
      return errorResponse('VALIDATION_ERROR', 'Invalid update.', 400);
    }

    const issue = maintenanceIssues.find(
      (i) => i.issue_id === Number(params.issue_id),
    );
    if (!issue) return errorResponse('NOT_FOUND', 'Issue not found.', 404);

    if (issue.status === 'resolved' && body.status !== undefined) {
      return errorResponse(
        'CONFLICT',
        'A resolved issue cannot be reopened.',
        409,
      );
    }

    if (body.priority !== undefined) {
      issue.priority = body.priority as MaintenanceIssue['priority'];
    }
    if (body.notes !== undefined) issue.notes = body.notes;
    if (body.status !== undefined) {
      issue.status = body.status as MaintenanceIssue['status'];
      if (body.status === 'resolved') issue.resolved_date = now;
    }
    return HttpResponse.json(issue);
  }),

  // ---- المدفوعات ----
  http.get(`${API}/reservations/:reservation_id/payments`, ({ params }) => {
    const id = Number(params.reservation_id);
    const totals = reservationTotals(id);
    if (!totals) return errorResponse('NOT_FOUND', 'Reservation not found.', 404);
    return HttpResponse.json({
      data: payments.filter((p) => p.reservation_id === id),
      ...totals,
    });
  }),

  http.get(`${API}/payments/room-balance/:room_id`, ({ params }) => {
    const roomParam = String(params.room_id);
    const room = rooms.find((r) => String(r.room_id) === roomParam);
    const totals = reservationTotals(55);
    return HttpResponse.json({
      reservation_id: '55',
      room_id: String(room?.room_id ?? '102'),
      room_number: String(room?.room_id ?? '102'),
      guest_name: 'محمود حسن',
      ...(totals || { total_amount: 4500, paid_amount: 1500, remaining_amount: 3000 }),
    });
  }),

  http.post(`${API}/payments`, async ({ request }) => {
    const blocked = guardWrite();
    if (blocked) return blocked;

    const key = request.headers.get('Idempotency-Key');
    if (!key) {
      return errorResponse(
        'VALIDATION_ERROR',
        'The Idempotency-Key header is required.',
        400,
      );
    }

    const bodyText = await request.text();
    const saved = idempotencyStore.get(key);
    if (saved) {
      if (saved.bodyText !== bodyText) {
        return errorResponse(
          'VALIDATION_ERROR',
          'This Idempotency-Key was already used with a different body.',
          400,
        );
      }
      return HttpResponse.json(saved.payload, {
        status: saved.status,
        headers: { 'Idempotent-Replayed': 'true' },
      });
    }

    let body: PaymentBody = {};
    try {
      body = JSON.parse(bodyText) as PaymentBody;
    } catch {
      return errorResponse('VALIDATION_ERROR', 'Invalid JSON body.', 400);
    }

    if (!body.reservation_id && !body.room_id) {
      return errorResponse(
        'VALIDATION_ERROR',
        'reservation_id or room_id is required in the mock.',
        400,
      );
    }
    const resId = body.reservation_id ?? 55;
    const totals = reservationTotals(resId);
    if (!totals) return errorResponse('NOT_FOUND', 'Reservation not found.', 404);

    if (
      !body.payment_method ||
      !PAYMENT_METHODS.includes(body.payment_method)
    ) {
      return errorResponse('VALIDATION_ERROR', 'Invalid payment_method.', 400);
    }
    if (
      typeof body.amount !== 'number' ||
      body.amount <= 0 ||
      body.amount > totals.remaining_amount
    ) {
      return errorResponse(
        'VALIDATION_ERROR',
        `amount must be greater than 0 and not more than the remaining amount (${totals.remaining_amount.toFixed(2)}).`,
        400,
      );
    }

    const resolvedResId = body.reservation_id ?? 55;
    const payment: Payment = {
      payment_id: newId(),
      reservation_id: resolvedResId,
      staff_id: 1,
      shift_id: mockShift.shift_id,
      amount: body.amount,
      payment_method: body.payment_method as Payment['payment_method'],
      notes: body.notes ?? null,
      payment_datetime: now,
      payment_verified: false,
      reversal_of_payment_id: null,
    };
    payments.push(payment);

    const after = reservationTotals(resolvedResId);
    const payload = {
      payment,
      paid_amount: after?.paid_amount ?? 0,
      remaining_amount: after?.remaining_amount ?? 0,
    };
    idempotencyStore.set(key, { bodyText, status: 201, payload });
    return HttpResponse.json(payload, { status: 201 });
  }),
];

export const handlers = [
  ...writeHandlers,

  // Development-only mock login. Not real authentication.
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    if (!body.username?.trim() || !body.password) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Username and password are required.',
        400,
      );
    }

    return HttpResponse.json({
      access_token: 'mock-access-token',
      expires_in: 900,
      staff: {
        staff_id: 1,
        name: 'Demo Receptionist',
        default_shift_type: 'morning',
      },
      shift: { ...mockShift },
      read_only: false,
    });
  }),

  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({
      access_token: 'mock-refreshed-access-token',
      expires_in: 900,
    }),
  ),

  http.get(`${API}/dashboard`, () =>
    HttpResponse.json({
      total_rooms: rooms.length,
      rooms_by_status: roomsByStatus(),
      rooms_needing_cleaning: cleaningTasks.filter(
        (task) => task.status === 'pending',
      ).length,
      open_maintenance_issues: maintenanceIssues.filter(
        (issue) => issue.status !== 'resolved',
      ).length,
      shift_payments_total: paymentTotals(),
    }),
  ),

  http.get(`${API}/rooms`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const roomType = url.searchParams.get('room_type');

    const filtered = rooms.filter((room) => {
      return (
        (!status || room.status === status) &&
        (!roomType || room.room_type === roomType)
      );
    });

    return HttpResponse.json(paginate(filtered, request));
  }),

  http.get(`${API}/cleaning-tasks`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const roomId = url.searchParams.get('room_id');

    const filtered = cleaningTasks.filter((task) => {
      return (
        (!status || task.status === status) &&
        (!priority || task.priority === priority) &&
        (!roomId || task.room_id === Number(roomId))
      );
    });

    return HttpResponse.json(paginate(filtered, request));
  }),

  http.get(`${API}/maintenance-issues`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const roomId = url.searchParams.get('room_id');

    const filtered = maintenanceIssues.filter((issue) => {
      return (
        (!status || issue.status === status) &&
        (!priority || issue.priority === priority) &&
        (!roomId || issue.room_id === Number(roomId))
      );
    });

    return HttpResponse.json(paginate(filtered, request));
  }),

  http.get(`${API}/payments`, ({ request }) =>
    HttpResponse.json(paginate(payments, request)),
  ),

  http.get(`${API}/shifts/current`, () => {
    if (mockShift.status !== 'active') {
      return errorResponse(
        'NOT_FOUND',
        'No active shift.',
        404,
      );
    }

    return HttpResponse.json({ ...mockShift });
  }),

  http.get(`${API}/shifts/current/summary`, () => {
    if (mockShift.status !== 'active') {
      return errorResponse(
        'NOT_FOUND',
        'No active shift.',
        404,
      );
    }

    return HttpResponse.json({
      shift: { ...mockShift, shift_notes: shiftNotes },
      payments: paymentTotals(),
      check_ins: 1,
      check_outs: 0,
      rooms_handled: [101, 102, 103],
      cleaning_tasks: [...cleaningTasks],
      maintenance_issues: [...maintenanceIssues],
      pending: {
        cleaning_tasks: cleaningTasks.filter(
          (task) => task.status === 'pending',
        ),
        maintenance_issues: maintenanceIssues.filter(
          (issue) => issue.status !== 'resolved',
        ),
        unverified_payments: payments.filter(
          (payment) => !payment.payment_verified,
        ),
      },
    });
  }),

  http.patch(
    `${API}/shifts/current/handover`,
    async ({ request }) => {
      if (mockShift.status === 'handed_over') {
        return errorResponse(
          'SHIFT_CLOSED',
          'This shift has already been handed over.',
          409,
        );
      }

      let body: { shift_notes?: string } = {};

      try {
        body = (await request.json()) as {
          shift_notes?: string;
        };
      } catch {
        // The request body is optional in the API contract.
      }

      if ((body.shift_notes?.length ?? 0) > 2000) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Shift notes must not exceed 2000 characters.',
          400,
        );
      }

      shiftNotes = body.shift_notes ?? null;
      mockShift.shift_notes = shiftNotes;
      mockShift.status = 'handed_over';
      mockShift.handed_over_at = now;

      // Contract: handover returns the Shift object itself.
      return HttpResponse.json({ ...mockShift });
    },
  ),

  http.get(`${API}/shifts/:shift_id/report`, ({ params }) => {
    if (mockShift.status !== 'handed_over') {
      return errorResponse(
        'NOT_FOUND',
        'The report is generated at handover.',
        404,
      );
    }

    if (Number(params.shift_id) !== mockShift.shift_id) {
      return errorResponse(
        'NOT_FOUND',
        'Shift report not found.',
        404,
      );
    }

    // Minimal demo PDF bytes; not a real generated shift report.
    const pdf = [
      '%PDF-1.1',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R >> endobj',
      '4 0 obj << /Length 0 >> stream',
      '',
      'endstream endobj',
      'trailer << /Root 1 0 R >>',
      '%%EOF',
    ].join('\n');

    return new HttpResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="shift-report.pdf"',
      },
    });
  }),
];