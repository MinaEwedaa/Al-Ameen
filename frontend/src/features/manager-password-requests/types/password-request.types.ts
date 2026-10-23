// =====================================================================
// Password Reset Requests Types — Contract v1.2 Specifications & UI Models
// =====================================================================

// ---------- Contract Sec 3 API Schemas ----------
export type ApiPasswordResetStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface ApiPasswordResetRequest {
  id: string;
  staff_id: string;
  staff_name: string;
  // Contract v1.2 Staff.staff_type
  staff_type: 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPER' | 'TECHNICIAN' | 'ADMIN' | string;
  reason: string;
  status: ApiPasswordResetStatus;
  created_at: string;
  decided_at?: string;
  temporary_password?: string;
}

export interface ApiDecisionPayload {
  action: 'APPROVE' | 'REJECT';
  temporary_password?: string;
  manager_note?: string;
}

export interface ApiDecisionResponse {
  data: {
    id: string;
    status: 'APPROVED' | 'REJECTED';
    decided_at: string;
  };
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: ApiPaginationMeta;
}

// ---------- UI View Models ----------
export type PasswordRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export interface PasswordRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  username: string;
  createdAt: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  reason: string;
  tempPassword?: string;
  resolvedAt?: string;
}

export interface PasswordRequestFilters {
  status?: PasswordRequestStatus | 'all';
  search?: string;
}
