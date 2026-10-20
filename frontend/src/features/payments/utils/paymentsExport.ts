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

/**
 * Prints the hotel payment voucher.
 * Uses an isolated, dedicated hidden iframe to ensure only the voucher is rendered
 * on a clean single A4 page with 0 background bleed, no app shell clutter, and no extra blank pages.
 */
export function printReceipt(elementId = 'payment-receipt'): void {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  // Create an invisible iframe for isolated printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    window.print();
    return;
  }

  // Collect active style and link elements to preserve fonts and design tokens
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');

  const dir = document.documentElement.dir || 'rtl';
  const lang = document.documentElement.lang || 'ar';

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html dir="${dir}" lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <title>إيصال دفع - فندق الأمين</title>
        ${styles}
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: 'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            padding: 12px !important;
          }
          .receipt-voucher {
            position: static !important;
            display: flex !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 180mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: 2px solid #0f2c33 !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .receipt-voucher * {
            visibility: visible !important;
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  };

  // Allow images (like logo) and fonts to settle before triggering print
  const logo = doc.querySelector('img');
  if (logo && !logo.complete) {
    logo.onload = () => setTimeout(triggerPrint, 80);
    logo.onerror = () => triggerPrint();
  } else {
    setTimeout(triggerPrint, 150);
  }
}
