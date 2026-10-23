import { http, HttpResponse } from 'msw';
import type {
  ApiMeProfile,
  ApiMeStats,
  ApiMeActivity,
} from '../../features/manager-profile/types/manager-profile.types';

const API = '/api/v1';

// Contract Sec 2 — Default Manager Profile Object
let currentMeProfile: ApiMeProfile = {
  id: '6719b4a1f2e8c90012ab3402',
  full_name: 'أحمد حسن',
  email: 'manager@alaminhotel.com',
  phone: '+20 100 000 0000',
  staff_type: 'MANAGER',
  is_active: true,
};

// Contract Sec 2 — Default Manager Stats
const meStats: ApiMeStats = {
  audits_this_month: 12,
  decisions_this_month: 34,
  active_employees: 28,
  occupancy_rate: 64,
};

// Contract Sec 2 — Default Manager Activities
const meActivities: ApiMeActivity[] = [
  {
    id: 'act_1',
    action: 'APPROVAL_DECISION',
    description: 'تمت الموافقة على طلب إجازة',
    created_at: '2026-10-23T14:45:00Z',
  },
  {
    id: 'act_2',
    action: 'PASSWORD_RESET',
    description: 'تم تعيين كلمة مرور لموظف',
    created_at: '2026-10-23T12:30:00Z',
  },
  {
    id: 'act_3',
    action: 'MAINTENANCE_LOG',
    description: 'تمت مراجعة بلاغ صيانة طارئ',
    created_at: '2026-10-23T10:15:00Z',
  },
];

export const managerProfileHandlers = [
  /**
   * Contract Sec 2:
   * GET /api/v1/auth/me
   */
  http.get(`${API}/auth/me`, () => {
    return HttpResponse.json({ data: currentMeProfile });
  }),

  /**
   * Contract Sec 2:
   * PATCH /api/v1/auth/me
   * Payload: { full_name, phone, email }
   */
  http.patch(`${API}/auth/me`, async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as Record<string, string>;

    const fullName = payload.full_name || payload.name;
    if (fullName !== undefined && !fullName.trim()) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 },
      );
    }

    const email = payload.email;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid email address' } },
        { status: 400 },
      );
    }

    currentMeProfile = {
      ...currentMeProfile,
      full_name: fullName !== undefined ? fullName.trim() : currentMeProfile.full_name,
      email: email !== undefined ? email.trim() : currentMeProfile.email,
      phone: payload.phone !== undefined ? payload.phone.trim() : currentMeProfile.phone,
    };

    return HttpResponse.json({ data: currentMeProfile });
  }),

  /**
   * Contract Sec 2:
   * POST /api/v1/auth/change-password
   * Payload: { current_password, new_password }
   */
  http.post(`${API}/auth/change-password`, async ({ request }) => {
    return handleChangePassword(request);
  }),

  /**
   * Contract Sec 2:
   * GET /api/v1/auth/me/stats
   */
  http.get(`${API}/auth/me/stats`, () => {
    return HttpResponse.json({ data: meStats });
  }),

  /**
   * Contract Sec 2:
   * GET /api/v1/auth/me/activities
   */
  http.get(`${API}/auth/me/activities`, () => {
    return HttpResponse.json({ data: meActivities });
  }),

  // Compatibility aliases for legacy calls
  http.get(`${API}/manager/profile`, () => {
    return HttpResponse.json({ data: currentMeProfile });
  }),

  http.patch(`${API}/manager/profile`, async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as Record<string, string>;
    const fullName = payload.full_name || payload.name;
    currentMeProfile = {
      ...currentMeProfile,
      full_name: fullName !== undefined ? fullName.trim() : currentMeProfile.full_name,
      email: payload.email !== undefined ? payload.email.trim() : currentMeProfile.email,
      phone: payload.phone !== undefined ? payload.phone.trim() : currentMeProfile.phone,
    };
    return HttpResponse.json({ data: currentMeProfile });
  }),

  http.get(`${API}/manager/profile/kpis`, () => {
    return HttpResponse.json({ data: meStats });
  }),

  http.get(`${API}/manager/profile/activities`, () => {
    return HttpResponse.json({ data: meActivities });
  }),
];

async function handleChangePassword(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, string>;
  const currentPassword = payload.current_password || payload.currentPassword;
  const newPassword = payload.new_password || payload.newPassword;
  const confirmPassword = payload.confirm_password || payload.confirmPassword;

  // In mock mode: accept any non-empty current password
  if (!currentPassword || !String(currentPassword).trim()) {
    return HttpResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Current password is required', field: 'currentPassword' } },
      { status: 400 },
    );
  }

  if (!newPassword || newPassword.length < 8) {
    return HttpResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters', field: 'newPassword' } },
      { status: 400 },
    );
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return HttpResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Passwords do not match', field: 'confirmPassword' } },
      { status: 400 },
    );
  }

  return HttpResponse.json({
    data: {
      message: 'Password changed successfully',
    },
  });
}
