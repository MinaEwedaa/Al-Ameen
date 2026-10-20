import type { Payment } from '../types/payment.types';
import { DEFAULT_CURRENCY } from '../../../core/utils/currency';

const CSV_HEADERS = [
  'Invoice No',
  'Guest',
  'Room',
  'Amount',
  'Currency',
  'Method',
  'Status',
  'Paid At',
  'Recorded By',
];

function escapeCell(value: string | number | undefined): string {
  const raw = value === undefined || value === null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

/** Builds a UTF-8 BOM prefixed CSV so Arabic content opens correctly in Excel. */
export function buildPaymentsCsv(rows: Payment[]): string {
  const lines = [CSV_HEADERS.map(escapeCell).join(',')];

  rows.forEach((row) => {
    lines.push(
      [
        row.invoiceNo ?? row.id,
        row.guestName,
        row.roomNo,
        row.amount,
        DEFAULT_CURRENCY,
        row.method,
        row.status,
        row.paidAt,
        row.recordedBy,
      ]
        .map(escapeCell)
        .join(','),
    );
  });

  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildPaymentsFileName(today: Date = new Date()): string {
  return `payments-report-${today.toISOString().slice(0, 10)}.csv`;
}

/** Prints the currently rendered receipt (uses the `@media print` rules). */
export function printReceipt(): void {
  window.print();
}
