import { useActivity } from '@/api/queries/useActivity'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function ActivityTimeline() {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivity()
  const parentRef = useRef<HTMLDivElement>(null)

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  if (isLoading) return <div className="animate-pulse h-64 rounded-xl bg-bg-card" />
  if (isError)   return <p className="text-text-muted">Failed to load activity.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Activity</h1>
      <div ref={parentRef} className="h-[600px] overflow-y-auto" role="status" aria-live="polite">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const isLoader = vRow.index > allItems.length - 1
            if (isLoader) {
              if (hasNextPage) void fetchNextPage()
              return (
                <div key="loader" style={{ position: 'absolute', top: vRow.start, width: '100%' }} className="flex justify-center py-4">
                  {isFetchingNextPage && <span className="text-text-muted text-sm">Loading…</span>}
                </div>
              )
            }
            const item = allItems[vRow.index]
            return (
              <div
                key={item.id}
                style={{ position: 'absolute', top: vRow.start, width: '100%' }}
                className="rounded-lg bg-bg-card px-4 py-3"
              >
                <p className="text-sm font-medium text-text-primary">{item.title}</p>
                {item.body && <p className="text-xs text-text-muted">{item.body}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
