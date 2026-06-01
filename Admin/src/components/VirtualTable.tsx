import { useRef, useEffect } from 'react'
import { flexRender, type Table as TTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

const ROW_HEIGHT = 48

interface VirtualTableProps<T> {
  table: TTable<T>
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onFetchMore?: () => void
}

export function VirtualTable<T>({ table, hasNextPage, isFetchingNextPage, onFetchMore }: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  useEffect(() => {
    const last = virtualizer.getVirtualItems().at(-1)
    if (last && last.index >= rows.length - 1 && hasNextPage && !isFetchingNextPage) {
      onFetchMore?.()
    }
  }, [virtualizer.getVirtualItems()])

  return (
    <div className="rounded-lg border border-[var(--surface-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary sticky top-0 z-10">
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
      </table>
      <div ref={parentRef} className="h-[600px] overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = rows[vItem.index]
            return (
              <div
                key={vItem.key}
                style={{ position: 'absolute', top: vItem.start, height: ROW_HEIGHT, width: '100%' }}
                className="flex border-b border-[var(--surface-border)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="px-4 flex items-center text-text-primary flex-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        {isFetchingNextPage && (
          <div className="py-4 text-center text-text-muted text-sm">Loading more…</div>
        )}
      </div>
    </div>
  )
}
