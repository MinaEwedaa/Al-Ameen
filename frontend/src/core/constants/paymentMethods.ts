export const PAYMENT_METHODS = {
  cash: 'Cash',
  card: 'Card',
  transfer: 'Transfer',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
