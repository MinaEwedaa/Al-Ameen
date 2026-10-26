import { http, HttpResponse } from 'msw';
import type {
  ApiPasswordResetRequest,
  ApiListResponse,
  ApiDecisionPayload,
  ApiDecisionResponse,
} from '../../features/manager-password-requests/types/password-request.types';

const API = '/api/v1';

// Contract Sec 3 Mock Database
const mockResetRequests: ApiPasswordResetRequest[] = [
  {
    id: '6719b4a1f2e8c90012ab3499',
    staff_id: '6719b4a1f2e8c90012ab3408',
    staff_name: 'كريم نبيل',
    staff_type: 'RECEPTIONIST',
    reason: 'نسيان كلمة المرور بعد إجازة',
    status: 'PENDING',
    created_at: '2026-10-23T13:20:00Z',
  },
  {
    id: '6719b4a1f2e8c90012ab3498',
    staff_id: '6719b4a1f2e8c90012ab3409',
    staff_name: 'سارة محمود',
    staff_type: 'RECEPTIONIST',
    reason: 'تعذر الدخول إلى الحاسوب ويحتاج الموظف إلى كلمة مرور مؤقتة',
    status: 'IN_REVIEW',
    created_at: '2026-10-23T11:15:00Z',
  },
  {
    id: '6719b4a1f2e8c90012ab3497',
    staff_id: '6719b4a1f2e8c90012ab3410',
    staff_name: 'محمد علي',
    staff_type: 'TECHNICIAN',
    reason: 'إعادة تعيين روتينية للحساب',
    status: 'APPROVED',
    created_at: '2026-10-22T09:00:00Z',
    temporary_password: 'Al-Amin#2026',
    decided_at: '2026-10-22T09:20:00Z',
  },
  {
    id: 'pr-1',
    staff_id: 'emp-101',
    staff_name: 'موظف استقبال أ',
    staff_type: 'RECEPTIONIST',
    reason: 'تعذر الدخول إلى الحاسوب ويحتاج الموظف إلى كلمة مرور مؤقتة',
    status: 'PENDING',
    created_at: '2026-10-23T05:10:00Z',
  },
];

export const managerPasswordRequestsHandlers = [
  /**
   * Contract Sec 3:
   * GET /api/v1/password-reset-requests?status=PENDING
   */
  http.get(`${API}/password-reset-requests`, ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toUpperCase();

    let filtered = [...mockResetRequests];
    if (statusParam && statusParam !== 'ALL') {
      filtered = filtered.filter((item) => item.status === statusParam);
    }

    const payload: ApiListResponse<ApiPasswordResetRequest> = {
      data: filtered,
      meta: {
        page: 1,
        limit: 20,
        total: filtered.length,
        total_pages: Math.max(1, Math.ceil(filtered.length / 20)),
      },
    };

    return HttpResponse.json(payload);
  }),

  /**
   * Contract Sec 3:
   * GET /api/v1/password-reset-requests/:id
   */
  http.get(`${API}/password-reset-requests/:id`, ({ params }) => {
    const item = mockResetRequests.find((r) => r.id === params.id);
    if (!item) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ data: item });
  }),

  /**
   * Contract Sec 3:
   * PATCH /api/v1/password-reset-requests/:id/decision
   * Header: Idempotency-Key: <UUID>
   * Payload: { action: "APPROVE" | "REJECT", temporary_password, manager_note }
   */
  http.patch(`${API}/password-reset-requests/:id/decision`, async ({ params, request }) => {
    const item = mockResetRequests.find((r) => r.id === params.id);
    if (!item) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ApiDecisionPayload>;
    const decidedAt = new Date().toISOString();

    if (body.action === 'APPROVE') {
      item.status = 'APPROVED';
      item.temporary_password = body.temporary_password || 'Al-Amin#2026';
      item.decided_at = decidedAt;
    } else {
      item.status = 'REJECTED';
      item.decided_at = decidedAt;
    }

    const response: ApiDecisionResponse = {
      data: {
        id: item.id,
        status: item.status as 'APPROVED' | 'REJECTED',
        decided_at: decidedAt,
      },
    };

    return HttpResponse.json(response);
  }),

  // Handlers for /manager/password-reset-requests
  http.get(`${API}/manager/password-reset-requests`, ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toUpperCase();

    let filtered = [...mockResetRequests];
    if (statusParam && statusParam !== 'ALL') {
      filtered = filtered.filter((item) => item.status === statusParam);
    }

    return HttpResponse.json({
      data: filtered,
      meta: {
        page: 1,
        limit: 20,
        total: filtered.length,
        total_pages: Math.max(1, Math.ceil(filtered.length / 20)),
      },
      pagination: {
        page: 1,
        limit: 20,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / 20)),
      },
    });
  }),

  http.patch(`${API}/manager/password-reset-requests/:id/decision`, async ({ params, request }) => {
    const item = mockResetRequests.find((r) => r.id === params.id);
    if (!item) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ApiDecisionPayload>;
    const decidedAt = new Date().toISOString();

    if (body.action === 'APPROVE') {
      item.status = 'APPROVED';
      item.temporary_password = body.temporary_password || 'Al-Amin#2026';
      item.decided_at = decidedAt;
    } else {
      item.status = 'REJECTED';
      item.decided_at = decidedAt;
    }

    return HttpResponse.json({
      data: {
        id: item.id,
        status: item.status as 'APPROVED' | 'REJECTED',
        staff_id: item.staff_id,
        temporary_password: item.temporary_password,
        decided_at: decidedAt,
      },
    });
  }),

  // Compatibility aliases for legacy endpoints
  http.get(`${API}/manager/password-requests`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status')?.toUpperCase();
    let filtered = [...mockResetRequests];
    if (status && status !== 'ALL') {
      filtered = filtered.filter((item) => item.status === status);
    }
    return HttpResponse.json({
      data: filtered,
      meta: { page: 1, limit: 20, total: filtered.length, total_pages: 1 },
      total: filtered.length,
    });
  }),

  http.get(`${API}/manager/password-requests/:id`, ({ params }) => {
    const item = mockResetRequests.find((r) => r.id === params.id);
    if (!item) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ data: item, ...item });
  }),

  http.post(`${API}/manager/password-requests/:id/approve`, async ({ params, request }) => {
    const item = mockResetRequests.find((r) => r.id === params.id);
    if (!item) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as { tempPassword?: string };
    item.status = 'APPROVED';
    item.temporary_password = body.tempPassword || 'Al-Amin#2026';
    item.decided_at = new Date().toISOString();
    return HttpResponse.json({ data: item, ...item });
  }),

  http.post(`${API}/manager/password-requests/:id/reject`, async ({ params }) => {
    const item = mockResetRequests.find((r) => r.id === params.id);
    if (!item) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 },
      );
    }
    item.status = 'REJECTED';
    item.decided_at = new Date().toISOString();
    return HttpResponse.json({ data: item, ...item });
  }),
];
