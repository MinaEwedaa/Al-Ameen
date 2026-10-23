import { http, HttpResponse } from 'msw';

const API = '/api/v1';

export const managerAuthHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    try {
      const cloned = request.clone();
      const body = (await cloned.json()) as { username?: string; password?: string };

      if (body.username === 'manager') {
        return HttpResponse.json({
          access_token: 'mock-manager-access-token',
          expires_in: 900,
          staff: {
            staff_id: 99,
            name: 'مدير الفندق',
            role: 'manager',
            default_shift_type: 'morning',
          },
          shift: null,
          read_only: false,
        });
      }
    } catch {
      // Fall through to next handler if JSON parse fails
    }

    return undefined;
  }),

  http.post(`${API}/auth/logout`, () => {
    return HttpResponse.json({ success: true });
  }),
];
