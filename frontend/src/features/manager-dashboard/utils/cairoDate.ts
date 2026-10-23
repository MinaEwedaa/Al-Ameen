/**
 * Returns the current business date in Africa/Cairo timezone as YYYY-MM-DD.
 * Per Manager API Contract v1.2, shifts overview requires Cairo local date.
 */
export function getCairoBusinessDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
