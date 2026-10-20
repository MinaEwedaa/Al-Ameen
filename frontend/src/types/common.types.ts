export type PaginationOptions = {
  page: number;
  pageSize: number;
};

export type ListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
// ---- أنواع مشتركة من الـ OpenAPI (مكان محايد، أي feature تقدر تستخدمها) ----
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type PaymentMethod = 'cash' | 'instapay' | 'vodafone_cash';
export type RoomStatus =
  | 'available'
  | 'reserved'
  | 'occupied'
  | 'cleaning'
  | 'maintenance';
export type CleaningTaskStatus = 'pending' | 'done';
export type MaintenanceIssueStatus = 'open' | 'in_progress' | 'resolved';