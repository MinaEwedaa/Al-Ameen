// Manager Finance API Service
// Implements Manager API Contract v1.2 endpoints and /mock-only/ finance endpoints

import { request } from '../../../core/api/apiClient';
import type {
  ListEnvelopeDto,
  SingleEnvelopeDto,
  FinancePaymentDto,
  DailyClosingCurrentDto,
  FinanceExpenseDto,
  HourlyRevenueDto,
  PaymentsQueryFiltersDto,
  ExpensesQueryFiltersDto,
  UpdatePaymentStatusDto,
  UpdateExpenseDto,
} from '../types/manager-finance.dto';
import type { TransactionStatusCode } from '../constants/finance.constants';

export const financeQueryKeys = {
  all: ['manager-finance'] as const,
  payments: (filters?: Record<string, unknown>) =>
    [...financeQueryKeys.all, 'payments', filters] as const,
  dailyClosing: () => [...financeQueryKeys.all, 'daily-closing'] as const,
  expenses: (filters?: Record<string, unknown>) =>
    [...financeQueryKeys.all, 'expenses', filters] as const,
  hourlyRevenue: () => [...financeQueryKeys.all, 'hourly-revenue'] as const,
  summary: () => [...financeQueryKeys.all, 'summary'] as const,
};

/**
 * GET /payments
 * Master ledger of payment transactions; filters: date, shift, method, type, status.
 * Contract v1.2: always passes limit.
 */
export async function getPayments(
  filters: PaymentsQueryFiltersDto = {},
): Promise<ListEnvelopeDto<FinancePaymentDto>> {
  const params: Record<string, unknown> = {
    limit: filters.limit ?? 20,
    page: filters.page ?? 1,
  };
  if (filters.date) params.date = filters.date;
  if (filters.shift) params.shift = filters.shift;
  if (filters.method && filters.method !== 'ALL') params.method = filters.method;
  if (filters.type && filters.type !== 'ALL') params.type = filters.type;
  if (filters.status && filters.status !== 'ALL') params.status = filters.status;
  if (filters.search) params.search = filters.search;

  return request<ListEnvelopeDto<FinancePaymentDto>>('/manager/payments', {
    method: 'GET',
    params,
  });
}

/**
 * GET /daily-closings/current
 * Live balances of the open business day (cash, instapay, vodafone, gross, refunds, total).
 */
export async function getDailyClosingCurrent(): Promise<DailyClosingCurrentDto> {
  const res = await request<SingleEnvelopeDto<DailyClosingCurrentDto>>('/manager/daily-closings/current', {
    method: 'GET',
  });
  return res.data;
}

/**
 * GET /mock-only/expenses
 * List recorded hotel operational expenses with category and date filtering.
 * Not in contract v1.2; served from /mock-only/ mock handler.
 */
export async function getExpenses(
  filters: ExpensesQueryFiltersDto = {},
): Promise<ListEnvelopeDto<FinanceExpenseDto>> {
  const params: Record<string, unknown> = {
    limit: filters.limit ?? 20,
    page: filters.page ?? 1,
  };
  if (filters.date) params.date = filters.date;
  if (filters.category && filters.category !== 'ALL') params.category = filters.category;
  if (filters.search) params.search = filters.search;

  return request<ListEnvelopeDto<FinanceExpenseDto>>('/mock-only/expenses', {
    method: 'GET',
    params,
  });
}

/**
 * GET /mock-only/finance/hourly-revenue
 * Shift hourly revenue series for the Finance overview curve chart.
 * Not in contract v1.2; served from /mock-only/ mock handler.
 */
export async function getHourlyRevenue(): Promise<HourlyRevenueDto> {
  const res = await request<SingleEnvelopeDto<HourlyRevenueDto>>(
    '/mock-only/finance/hourly-revenue',
    {
      method: 'GET',
    },
  );
  return res.data;
}

/**
 * PATCH /mock-only/payments/:id/status
 * Updates a payment's status (completed, pending, refunded, cancelled).
 * Conflict note: Contract v1.2 specifies payments are immutable; provided on /mock-only/ for design parity.
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: TransactionStatusCode,
  reason?: string,
): Promise<FinancePaymentDto> {
  const body: UpdatePaymentStatusDto = { status, reason };
  const res = await request<SingleEnvelopeDto<FinancePaymentDto>>(
    `/mock-only/payments/${paymentId}/status`,
    {
      method: 'PATCH',
      body,
    },
  );
  return res.data;
}

/**
 * PATCH /mock-only/expenses/:id
 * Updates an operational expense entry.
 * Not in contract v1.2; served from /mock-only/ mock handler.
 */
export async function updateExpense(
  expenseId: string,
  payload: UpdateExpenseDto,
): Promise<FinanceExpenseDto> {
  const res = await request<SingleEnvelopeDto<FinanceExpenseDto>>(
    `/mock-only/expenses/${expenseId}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
  return res.data;
}
