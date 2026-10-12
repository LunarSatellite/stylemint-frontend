import type { ReactNode } from 'react';

/**
 * A plain table with the header treatment every list here shares.
 *
 * Columns are described rather than written as JSX so a screen cannot
 * quietly drift into its own header styling, which is how the console
 * this replaces ended up rendering the same element eight ways.
 */
export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-align numbers and dates. */
  align?: 'left' | 'right';
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-surface-border">
          {columns.map((c) => (
            <th
              key={c.header}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted ${
                c.align === 'right' ? 'text-right' : 'text-left'
              }`}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b border-surface-border last:border-0">
            {columns.map((c) => (
              <td
                key={c.header}
                className={`px-4 py-3 text-text-secondary ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
