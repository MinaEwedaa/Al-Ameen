export type PaymentsDateRange = 'all' | 'today' | 'week' | 'month';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `today`, `week`, `month` -> inclusive YYYY-MM-DD range ending today */
export function rangeToDates(range: PaymentsDateRange, now = new Date()): { from: string; to: string } {
  if (range === 'all') return { from: '', to: '' };
  const days = range === 'today' ? 0 : range === 'week' ? 6 : 29;
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);
  return { from, to };
}
