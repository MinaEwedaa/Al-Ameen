import type { ReactNode } from 'react';
import { useLanguage } from '../../core/i18n/useLanguage';
import { formatNumber } from '../../utils/format';
import './Table.css';

interface TableProps<T extends string> {
  columns: Array<{ key: T; label: string; render?: (row: unknown) => ReactNode }>;
  rows: unknown[];
  emptyMessage?: string;
  className?: string;
}

export function Table<T extends string>({ columns, rows, emptyMessage = 'No records found', className = '' }: TableProps<T>) {
  const { language } = useLanguage();
  const formatCell = (value: unknown): ReactNode => {
    if (typeof value === 'number') return formatNumber(value, language);
    if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) return formatNumber(Number(value), language);
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    return value as ReactNode;
  };

  const getCellValue = (row: unknown, column: TableProps<T>['columns'][number]): ReactNode => {
    if (column.render) return column.render(row);
    if (typeof row === 'object' && row !== null && column.key in row) {
      return formatCell((row as Record<string, unknown>)[column.key]);
    }
    return String(row);
  };

  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="ui-empty">{emptyMessage}</td></tr>
          ) : rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column.key}>{getCellValue(row, column)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
