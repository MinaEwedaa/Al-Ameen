// أكواد الأخطاء الرسمية من الباك اند (ErrorCode في الـ OpenAPI)
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'OUTSIDE_SHIFT_HOURS'
  | 'NOT_SCHEDULED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATUS_TRANSITION'
  | 'PAYMENT_REQUIRED'
  | 'BALANCE_DUE'
  | 'AMBIGUOUS_RESERVATION'
  | 'SHIFT_CLOSED'
  | 'SHIFT_HANDOVER_ONLY'
  | 'TOO_MANY_REQUESTS';

// أكواد بنضيفها إحنا في الفرونت (مش من الباك اند)
export type ClientErrorCode = 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

// شكل الخطأ اللي بيرجع من الباك اند
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

// القوائم كلها بترجع data + meta
export interface Meta {
  page: number;
  limit: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: Meta;
}

export interface ListParams {
  page?: number;
  limit?: number;
}