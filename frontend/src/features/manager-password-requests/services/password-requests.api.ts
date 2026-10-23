import { request } from '../../../core/api/apiClient';
import type {
  PasswordRequest,
  PasswordRequestFilters,
  ApiPasswordResetRequest,
  ApiListResponse,
  ApiDecisionPayload,
  ApiDecisionResponse,
} from '../types/password-request.types';

// ---------- Mapper from Contract v1.2 to UI Model ----------
export function mapApiToPasswordRequest(api: ApiPasswordResetRequest): PasswordRequest {
  const normalizedStatus = String(api.status).toLowerCase() as PasswordRequest['status'];

  let roleTitle = api.staff_type;
  if (api.staff_type === 'RECEPTIONIST') {
    roleTitle = 'موظف استقبال';
  } else if (api.staff_type === 'MAINTENANCE') {
    roleTitle = 'فني صيانة';
  } else if (api.staff_type === 'HOUSEKEEPING') {
    roleTitle = 'موظف نظافة';
  }

  return {
    id: api.id,
    employeeId: api.staff_id,
    employeeName: api.staff_name,
    role: roleTitle,
    username: api.staff_name.toLowerCase().replace(/\s+/g, '.'),
    createdAt: api.created_at,
    status: normalizedStatus,
    reason: api.reason,
    tempPassword: api.temporary_password,
    resolvedAt: api.decided_at,
  };
}

/**
 * GET /api/v1/password-reset-requests?status=PENDING
 */
export async function getPasswordRequests(
  filters?: PasswordRequestFilters,
): Promise<PasswordRequest[]> {
  const params: Record<string, string> = {};
  if (filters?.status && filters.status !== 'all') {
    // Contract Sec 3 uses uppercase status query (e.g., PENDING)
    params.status = filters.status.toUpperCase();
  }

  const response = await request<
    ApiListResponse<ApiPasswordResetRequest> | { data: ApiPasswordResetRequest[] } | PasswordRequest[]
  >('/password-reset-requests', { params });

  let rawList: ApiPasswordResetRequest[] = [];
  if (Array.isArray(response)) {
    return (response as PasswordRequest[]).map((item) =>
      'staff_id' in item ? mapApiToPasswordRequest(item as unknown as ApiPasswordResetRequest) : item,
    );
  } else if ('data' in response && Array.isArray(response.data)) {
    rawList = response.data;
  }

  return rawList.map(mapApiToPasswordRequest);
}

/**
 * GET /api/v1/password-reset-requests/:id
 */
export async function getPasswordRequest(id: string): Promise<PasswordRequest> {
  const response = await request<
    { data: ApiPasswordResetRequest } | ApiPasswordResetRequest | PasswordRequest
  >(`/password-reset-requests/${id}`);

  if ('data' in response && response.data) {
    return mapApiToPasswordRequest(response.data);
  }
  if ('staff_id' in response) {
    return mapApiToPasswordRequest(response as ApiPasswordResetRequest);
  }
  return response as PasswordRequest;
}

/**
 * PATCH /api/v1/password-reset-requests/:id/decision
 * Header: Idempotency-Key: <UUID>
 * Payload: { action: "APPROVE", temporary_password, manager_note }
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

  const body: ApiDecisionPayload = {
    action: 'APPROVE',
    temporary_password: tempPassword,
    manager_note: managerNote,
  };

  await request<ApiDecisionResponse>(`/password-reset-requests/${id}/decision`, {
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
    status: 'approved',
    reason: '',
    tempPassword,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * PATCH /api/v1/password-reset-requests/:id/decision
 * Header: Idempotency-Key: <UUID>
 * Payload: { action: "REJECT", temporary_password, manager_note }
 */
export async function rejectPasswordRequest(
  id: string,
  managerNote = '',
): Promise<PasswordRequest> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const body: ApiDecisionPayload = {
    action: 'REJECT',
    temporary_password: '',
    manager_note: managerNote,
  };

  await request<ApiDecisionResponse>(`/password-reset-requests/${id}/decision`, {
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
