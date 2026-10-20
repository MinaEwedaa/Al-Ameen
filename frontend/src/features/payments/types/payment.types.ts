export type ApiPaymentMethod = 'cash' | 'instapay' | 'vodafone_cash';

export interface ApiPayment {
  payment_id: number;
  reservation_id: number;
  staff_id: number;
  shift_id: number;
  amount: number;
  payment_method: ApiPaymentMethod;
  payment_datetime: string;
  payment_verified: boolean;
  notes?: string | null;
  reversal_of_payment_id?: number | null;
  guest_name?: string | null;
  room_number?: string | null;
}

export interface CreatePaymentInput {
  reservation_id?: number | string;
  room_id?: string;
  amount: number;
  payment_method: ApiPaymentMethod;
  notes?: string;
}

export interface CreatePaymentResponse {
  payment: ApiPayment;
  paid_amount: number;
  remaining_amount: number;
}

export interface Payment {
  id: string;
  invoiceNo?: string;
  guestName?: string;
  roomNo?: string;
  amount: number;
  currency?: string;
  method: string;
  status: string;
  paidAt?: string;
  recordedBy?: string;
  notes?: string | null;
}

export interface PaymentsReportFilters {
  from?: string;
  to?: string;
  method?: string;
  status?: string;
  query?: string;
}

