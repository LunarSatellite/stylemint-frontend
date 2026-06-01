import { flexRender, type Table as TTable } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'

interface DataTableProps<T> {
  table: TTable<T>
  isLoading?: boolean
}

export function DataTable<T>({ table, isLoading }: DataTableProps<T>) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--surface-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 text-left text-text-muted font-medium">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className="px-4 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className="px-4 py-8 text-center text-text-muted">
                  No results
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--surface-border)] hover:bg-surface-1 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-text-primary">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>{table.getRowCount()} total</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <span className="px-2 py-1">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
