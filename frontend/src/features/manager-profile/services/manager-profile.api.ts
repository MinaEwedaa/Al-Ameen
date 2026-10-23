import { request } from '../../../core/api/apiClient';
import type {
  ManagerProfile,
  ManagerKPIs,
  ManagerActivityItem,
  EditProfilePayload,
  ChangePasswordPayload,
  ApiMeProfile,
  ApiMeStats,
  ApiMeActivity,
  ApiSingleResponse,
  ApiChangePasswordPayload,
  ApiUpdateMePayload,
} from '../types/manager-profile.types';

// ---------- Adapters from Contract v1.2 Schemas to UI Models ----------
function mapApiMeToProfile(api: ApiMeProfile): ManagerProfile {
  return {
    id: api.id,
    name: api.full_name,
    accountName: api.full_name,
    role: api.staff_type === 'MANAGER' ? 'مدير الفندق' : api.staff_type,
    hotelName: 'Al Amin Hotel',
    location: 'أسوان، مصر',
    email: api.email,
    phone: api.phone,
    hireDate: '2023-01-15',
    lastLogin: 'اليوم، 08:12 ص',
    status: api.is_active ? 'active' : 'inactive',
  };
}

function mapApiStatsToKPIs(stats: ApiMeStats): ManagerKPIs {
  return {
    activeEmployees: stats.active_employees,
    activeEmployeesSub: 'جميع الأقسام',
    managedRooms: 36,
    managedRoomsSub: `إشغال اليوم ${stats.occupancy_rate}%`,
    generatedReports: stats.audits_this_month,
    generatedReportsSub: 'هذا الشهر',
    managementTasks: stats.decisions_this_month,
    managementTasksSub: 'قرارات هذا الشهر',
  };
}

function mapApiActivityToItem(act: ApiMeActivity): ManagerActivityItem {
  let type: ManagerActivityItem['type'] = 'other';
  let tone: ManagerActivityItem['tone'] = 'green';
  let title = act.description;

  if (act.action === 'APPROVAL_DECISION') {
    type = 'payment';
    tone = 'green';
    title = 'قرار اعتماد إداري';
  } else if (act.action === 'PASSWORD_RESET') {
    type = 'maintenance';
    tone = 'gold';
    title = 'إعادة تعيين كلمة مرور';
  }

  let timeStr = '12:00';
  try {
    const d = new Date(act.created_at);
    timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    timeStr = act.created_at;
  }

  return {
    id: act.id,
    type,
    title,
    description: act.description,
    time: timeStr,
    tone,
  };
}

// ---------- Contract v1.2 Endpoints ----------

/**
 * GET /api/v1/auth/me
 */
export async function getManagerProfile(): Promise<ManagerProfile> {
  const res = await request<ApiSingleResponse<ApiMeProfile> | ApiMeProfile>('/auth/me');
  const profileData = 'data' in res && res.data ? res.data : (res as ApiMeProfile);
  return mapApiMeToProfile(profileData);
}

/**
 * PATCH /api/v1/auth/me
 * Payload: { full_name, phone, email }
 */
export async function updateManagerProfile(payload: EditProfilePayload): Promise<ManagerProfile> {
  const body: ApiUpdateMePayload = {
    full_name: payload.name.trim(),
    phone: payload.phone.trim(),
    email: payload.email.trim(),
  };

  const res = await request<ApiSingleResponse<ApiMeProfile> | ApiMeProfile>('/auth/me', {
    method: 'PATCH',
    body,
  });

  const profileData = 'data' in res && res.data ? res.data : (res as ApiMeProfile);
  return mapApiMeToProfile(profileData);
}

/**
 * POST /api/v1/auth/change-password
 * Payload: { current_password, new_password }
 */
export async function changeManagerPassword(
  payload: ChangePasswordPayload,
): Promise<{ success: boolean; message: string }> {
  const body: ApiChangePasswordPayload = {
    current_password: payload.currentPassword,
    new_password: payload.newPassword,
  };

  const res = await request<{ data?: { message?: string }; message?: string }>('/auth/change-password', {
    method: 'POST',
    body,
  });

  return {
    success: true,
    message: res.data?.message || res.message || 'Password changed successfully',
  };
}

/**
 * GET /api/v1/auth/me/stats
 */
export async function getManagerKPIs(): Promise<ManagerKPIs> {
  const res = await request<ApiSingleResponse<ApiMeStats> | ApiMeStats>('/auth/me/stats');
  const statsData = 'data' in res && res.data ? res.data : (res as ApiMeStats);
  return mapApiStatsToKPIs(statsData);
}

/**
 * GET /api/v1/auth/me/activities
 */
export async function getManagerActivities(): Promise<ManagerActivityItem[]> {
  const res = await request<ApiSingleResponse<ApiMeActivity[]> | ApiMeActivity[]>('/auth/me/activities');
  const list = 'data' in res && Array.isArray(res.data) ? res.data : (res as ApiMeActivity[]);
  return list.map(mapApiActivityToItem);
}
