import { useState } from 'react'
import { useModerationQueue } from '@/api/queries/useModerationQueue'

type ModerationQueueFilter = NonNullable<import('@/api/schema').paths['/v1/admin/moderation/queue']['get']['parameters']['query']>
import { ModerationQueueView } from './ModerationQueueView'

const PAGE_SIZE = 20

export function ModerationQueueContainer() {
  const [filter, setFilter] = useState<ModerationQueueFilter>({
    pageNumber: 1,
    pageSize:   PAGE_SIZE,
  })

  const { data, isLoading, isError } = useModerationQueue(filter)

  function setPage(pageNumber: number) {
    setFilter(f => ({ ...f, pageNumber }))
  }

  function setFilterField<K extends keyof ModerationQueueFilter>(key: K, value: ModerationQueueFilter[K]) {
    setFilter(f => ({ ...f, [key]: value, pageNumber: 1 }))
  }

  if (isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load moderation queue.
    </div>
  )

  return (
    <ModerationQueueView
      data={data?.items ?? []}
      totalCount={data?.totalCount ?? 0}
      pageNumber={filter.pageNumber ?? 1}
      pageSize={PAGE_SIZE}
      totalPages={data?.totalPages ?? 1}
      hasNext={data?.hasNext ?? false}
      hasPrevious={data?.hasPrevious ?? false}
      filter={filter}
      isLoading={isLoading}
      onPageChange={setPage}
      onFilterChange={setFilterField}
    />
  )
}
