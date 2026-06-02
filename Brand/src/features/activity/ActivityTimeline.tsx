import { useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useActivity } from '@/api/queries/useActivity'
import { ActivityFilters } from './ActivityFilters'
import { formatDateTime } from '@/lib/formatters'
import type { ActivityFilter } from '@/api/queryKeys'
import type { VendorActivityEntryDto } from '@/api/schema'

interface ActivityTimelineProps {
  filter:   ActivityFilter
  onChange: (f: ActivityFilter) => void
}

export function ActivityTimeline({ filter, onChange }: ActivityTimelineProps) {
  const { data, isPending, isError, fetchNextPage, hasNextPage } = useActivity(filter)
  const parentRef  = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const items = data?.pages.flatMap((p) => p.items) ?? []

  const rowVirtualizer = useVirtualizer({
    count:            items.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 68,
    overscan:         10,
  })

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) fetchNextPage() },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage])

  if (isPending) return <ActivitySkeleton />
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Activity failed to load.</div>

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border-subtle)] px-6 py-3">
        <ActivityFilters filter={filter} onChange={onChange} />
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-sm text-[var(--text-muted)]">No activity yet.</div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto">
          <div
            style={{ height: rowVirtualizer.getTotalSize() }}
            className="relative w-full"
          >
            {rowVirtualizer.getVirtualItems().map((vItem) => {
              const item = items[vItem.index]
              if (!item) return null
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{ transform: `translateY(${vItem.start}px)` }}
                  className="absolute w-full px-6 py-2"
                >
                  <ActivityRow item={item} />
                </div>
              )
            })}
          </div>
          <div ref={sentinelRef} />
        </div>
      )}
    </div>
  )
}

function ActivityRow({ item }: { item: VendorActivityEntryDto }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {item.headline ?? 'Activity'}
        </p>
        {item.body && (
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{item.body}</p>
        )}
      </div>
      <time className="shrink-0 text-xs text-[var(--text-muted)]">
        {formatDateTime(item.occurredUtc)}
      </time>
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2 p-6" aria-busy="true" aria-label="Loading activity">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      ))}
    </div>
  )
}
