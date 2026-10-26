import { request } from '../../../core/api/apiClient';
import type {
  PasswordRequest,
  PasswordRequestFilters,
  ApiPasswordResetRequest,
  ApiListResponse,
  ApiDecisionResponse,
} from '../types/password-request.types';

// ---------- Mapper to UI Model ----------
export function mapApiToPasswordRequest(api: ApiPasswordResetRequest): PasswordRequest {
  const normalizedStatus = String(api.status || 'pending').toLowerCase() as PasswordRequest['status'];
  const role = api.staff_type || api.role || 'receptionist';
  const username = api.username || (api.staff_name ? String(api.staff_name).toLowerCase().replace(/\s+/g, '.') : '');
  const createdAt = api.requested_at || api.created_at || new Date().toISOString();
  const resolvedAt = api.decided_at || undefined;

  return {
    id: String(api.id || api._id || ''),
    employeeId: String(api.staff_id || ''),
    employeeName: String(api.staff_name || ''),
    role: String(role).toLowerCase(),
    username,
    createdAt,
    status: normalizedStatus,
    reason: api.reason || api.manager_comment || '',
    tempPassword: api.temporary_password || undefined,
    resolvedAt,
  };
}

/**
 * GET /api/v1/manager/password-reset-requests?status=PENDING
 */
export async function getPasswordRequests(
  filters?: PasswordRequestFilters,
): Promise<PasswordRequest[]> {
  const params: Record<string, string> = {};
  if (filters?.status && filters.status !== 'all') {
    params.status = filters.status.toUpperCase();
  }

  const response = await request<
    ApiListResponse<ApiPasswordResetRequest> | { data: ApiPasswordResetRequest[] } | ApiPasswordResetRequest[]
  >('/manager/password-reset-requests', { params });

  let rawList: ApiPasswordResetRequest[] = [];
  if (Array.isArray(response)) {
    rawList = response;
  } else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
    rawList = response.data;
  }

  return rawList.map(mapApiToPasswordRequest);
}

/**
 * GET /api/v1/manager/password-reset-requests/:id
 */
export async function getPasswordRequest(id: string): Promise<PasswordRequest> {
  const response = await request<
    { data: ApiPasswordResetRequest } | ApiPasswordResetRequest | PasswordRequest
  >(`/manager/password-reset-requests/${id}`);

  if (response && typeof response === 'object' && 'data' in response && response.data) {
    return mapApiToPasswordRequest(response.data as ApiPasswordResetRequest);
  }
  return mapApiToPasswordRequest(response as ApiPasswordResetRequest);
}

/**
 * PATCH /api/v1/manager/password-reset-requests/:id/decision
 * Header: Idempotency-Key: <UUID>
 * Payload: { action: "APPROVE", temporary_password, manager_comment }
 */
export async function approvePasswordRequest(
  id: string,
  tempPassword: string,
  managerNote = '',
): Promise<PasswordRequest> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const body = {
    action: 'APPROVE',
    temporary_password: tempPassword,
    manager_comment: managerNote,
  };

  const res = await request<
    ApiDecisionResponse | { data: { id: string; status: string; staff_id: string; temporary_password?: string } }
  >(`/manager/password-reset-requests/${id}/decision`, {
    method: 'PATCH',
    body,
    idempotencyKey,
  });

  const confirmedPassword =
    (res && typeof res === 'object' && 'data' in res && (res.data as { temporary_password?: string }).temporary_password) ||
    tempPassword;

  return {
    id,
    employeeId: (res && typeof res === 'object' && 'data' in res && (res.data as { staff_id?: string }).staff_id) || '',
    employeeName: '',
    role: '',
    username: '',
    createdAt: new Date().toISOString(),
    status: 'approved',
    reason: '',
    tempPassword: confirmedPassword,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * PATCH /api/v1/manager/password-reset-requests/:id/decision
 * Header: Idempotency-Key: <UUID>
 * Payload: { action: "REJECT", manager_comment }
 */
export async function rejectPasswordRequest(
  id: string,
  managerNote = '',
): Promise<PasswordRequest> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const body = {
    action: 'REJECT',
    manager_comment: managerNote,
  };

  await request<ApiDecisionResponse>(`/manager/password-reset-requests/${id}/decision`, {
    method: 'PATCH',
    body,
    idempotencyKey,
  });

  return {
    id,
    employeeId: '',
    employeeName: '',
    role: '',
    username: '',
    createdAt: new Date().toISOString(),
    status: 'rejected',
    reason: '',
    resolvedAt: new Date().toISOString(),
  };
}
