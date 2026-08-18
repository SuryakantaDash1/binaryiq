import type { ReactNode } from 'react';
import { cn } from './utils/cn.js';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  className?: string;
}

export function DataTable<T extends object>({ columns, rows, keyExtractor, className }: DataTableProps<T>): React.JSX.Element {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b">
            {columns.map((col) => (
              <th key={col.key} className={cn('text-secondary py-3 text-left font-medium', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyExtractor(row)} className="border-border hover:bg-bg border-b transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={cn('py-3', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export type { DataTableProps, Column };
