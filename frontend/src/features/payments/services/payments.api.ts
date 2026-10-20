import { request } from '../../../core/api/apiClient';
import type { Paginated } from '../../../core/api/api.types';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { PAYMENT_METHODS } from '../../../core/constants/paymentMethods';
import { STATUS } from '../../../core/constants/status';
import type {
  ApiPayment,
  CreatePaymentInput,
  CreatePaymentResponse,
  Payment,
  PaymentsReportFilters,
} from '../types/payment.types';

export const PAYMENTS_FETCH_LIMIT = 100;

export function mapApiPaymentToPayment(api: ApiPayment): Payment {
  let method: string = api.payment_method;
  if (api.payment_method === 'cash') {
    method = PAYMENT_METHODS.cash;
  } else if (api.payment_method === 'instapay') {
    method = PAYMENT_METHODS.card;
  } else if (api.payment_method === 'vodafone_cash') {
    method = PAYMENT_METHODS.transfer;
  }

  const status = api.reversal_of_payment_id
    ? STATUS.cancelled
    : api.payment_verified
      ? STATUS.completed
      : STATUS.pending;

  return {
    id: String(api.payment_id),
    invoiceNo: `INV-${api.payment_id}`,
    guestName: api.guest_name ?? (api.reservation_id ? `حجز #${api.reservation_id}` : undefined),
    roomNo: api.room_number ?? '',
    amount: api.amount,
    currency: 'EGP',
    method,
    status,
    paidAt: api.payment_datetime,
    recordedBy: `موظف #${api.staff_id}`,
    notes: api.notes ?? null,
  };
}

export async function getPayments(): Promise<Payment[]> {
  const response = await request<Paginated<ApiPayment>>('/payments', {
    params: { page: 1, limit: PAYMENTS_FETCH_LIMIT },
  });
  return response.data.map(mapApiPaymentToPayment);
}

export async function getPaymentsReport(filters: PaymentsReportFilters = {}): Promise<Payment[]> {
  const params: Record<string, unknown> = { page: 1, limit: PAYMENTS_FETCH_LIMIT };
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.method && filters.method !== 'all') {
    let methodParam = filters.method;
    if (filters.method === PAYMENT_METHODS.card || filters.method.toLowerCase() === 'card') {
      methodParam = 'instapay';
    } else if (filters.method === PAYMENT_METHODS.transfer || filters.method.toLowerCase() === 'transfer') {
      methodParam = 'vodafone_cash';
    } else if (filters.method === PAYMENT_METHODS.cash || filters.method.toLowerCase() === 'cash') {
      methodParam = 'cash';
    }
    params.method = methodParam;
  }
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.query) params.q = filters.query;

  const response = await request<Paginated<ApiPayment>>('/payments', {
    params,
  });
  return response.data.map(mapApiPaymentToPayment);
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse> {
  return request<CreatePaymentResponse>('/payments', {
    method: 'POST',
    body: input,
    idempotencyKey: newIdempotencyKey(),
  });
}


export interface ReservationBalance {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface RoomBalance {
  reservationId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

/** GET /reservations/{roomIdOrNumber}/payments — used to fetch the room's active reservation balance */
export async function getRoomBalance(roomIdOrNumber: string): Promise<RoomBalance> {
  const response = await request<{
    reservation_id: string;
    room_id: string;
    room_number: string;
    guest_name: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
  }>(`/reservations/${roomIdOrNumber}/payments`);
  return {
    reservationId: response.reservation_id,
    roomId: response.room_id,
    roomNumber: response.room_number,
    guestName: response.guest_name,
    totalAmount: response.total_amount,
    paidAmount: response.paid_amount,
    remainingAmount: response.remaining_amount,
  };
}

/** GET /reservations/{id}/payments — used by the add-payment form to show what is left to pay */
export async function getReservationBalance(reservationId: number): Promise<ReservationBalance> {
  const response = await request<{ total_amount: number; paid_amount: number; remaining_amount: number }>(
    `/reservations/${reservationId}/payments`,
  );
  return {
    totalAmount: response.total_amount,
    paidAmount: response.paid_amount,
    remainingAmount: response.remaining_amount,
  };
}
