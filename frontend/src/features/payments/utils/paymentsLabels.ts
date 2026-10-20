import { PAYMENT_METHODS } from '../../../core/constants/paymentMethods';
import { STATUS } from '../../../core/constants/status';

/** Badge tone shared by status / method pills on the payments page. */
export type PaymentsBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

export function statusTone(status: string): PaymentsBadgeTone {
  switch (status) {
    case STATUS.completed:
      return 'success';
    case STATUS.pending:
      return 'warning';
    case STATUS.inProgress:
      return 'info';
    case STATUS.cancelled:
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Translation key for the (English) status value coming from the API. */
export function statusLabelKey(status: string): string | null {
  switch (status) {
    case STATUS.completed:
      return 'paymentsPage.status.completed';
    case STATUS.pending:
      return 'paymentsPage.status.pending';
    case STATUS.inProgress:
      return 'paymentsPage.status.inProgress';
    case STATUS.cancelled:
      return 'paymentsPage.status.cancelled';
    default:
      return null;
  }
}

// The data layer maps instapay -> Card and vodafone_cash -> Transfer (see payments.api.ts),
// so the labels show the real wallet names the hotel uses.
export function methodLabelKey(method: string): string | null {
  switch (method) {
    case PAYMENT_METHODS.cash:
      return 'paymentsPage.method.cash';
    case PAYMENT_METHODS.card:
      return 'paymentsPage.method.instapay';
    case PAYMENT_METHODS.transfer:
      return 'paymentsPage.method.vodafone';
    default:
      return null;
  }
}

export function methodTone(method: string): PaymentsBadgeTone {
  switch (method) {
    case PAYMENT_METHODS.cash:
      return 'success';
    case PAYMENT_METHODS.card:
      return 'purple';
    case PAYMENT_METHODS.transfer:
      return 'warning';
    default:
      return 'neutral';
  }
}
