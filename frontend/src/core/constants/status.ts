export const STATUS = {
  pending: 'Pending',
  inProgress: 'InProgress',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];
