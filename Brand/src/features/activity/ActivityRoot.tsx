import { useState } from 'react'
import { ActivityTimeline } from './ActivityTimeline'
import type { ActivityFilter } from '@/api/queryKeys'

export function ActivityRoot() {
  const [filter, setFilter] = useState<ActivityFilter>({})

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border-subtle)] px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Activity</h1>
      </div>
      <ActivityTimeline filter={filter} onChange={setFilter} />
    </div>
  )
}
