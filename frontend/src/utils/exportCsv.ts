export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | undefined;
}

function escapeCsvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv<T>(rows: T[], columns: CsvColumn<T>[], fileName: string): boolean {
  if (rows.length === 0) return false;
  const lines = [
    columns.map((column) => escapeCsvCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
