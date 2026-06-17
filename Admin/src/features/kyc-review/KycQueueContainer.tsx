import { useState } from 'react'
import { useKycQueue } from '@/api/queries/useKycQueue'

type KycQueueFilter = NonNullable<import('@/api/schema').paths['/v1/admin/kyc/queue']['get']['parameters']['query']>
import { KycQueueView } from './KycQueueView'

const PAGE_SIZE = 20

export function KycQueueContainer() {
  const [filter, setFilter] = useState<KycQueueFilter>({
    pageNumber: 1,
    pageSize:   PAGE_SIZE,
  })

  const { data, isLoading, isError } = useKycQueue(filter)

  function setPage(pageNumber: number) {
    setFilter(f => ({ ...f, pageNumber }))
  }

  function setFilterField<K extends keyof KycQueueFilter>(key: K, value: KycQueueFilter[K]) {
    setFilter(f => ({ ...f, [key]: value, pageNumber: 1 }))
  }

  if (isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load KYC queue.
    </div>
  )

  return (
    <KycQueueView
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
