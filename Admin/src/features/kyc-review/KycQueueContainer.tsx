import { useState } from 'react'
import { useKycCreatorQueue, useKycVendorQueue } from '@/api/queries/useKycQueue'
import { KycQueueView } from './KycQueueView'
import type { paths } from '@/api/schema'

type CreatorFilter = NonNullable<paths['/v1/admin/kyc/creator/queue']['get']['parameters']['query']>
type VendorFilter  = NonNullable<paths['/v1/admin/kyc/vendor/queue']['get']['parameters']['query']>

const PAGE_SIZE = 25

export function KycQueueContainer() {
  const [tab, setTab] = useState<'creator' | 'vendor'>('creator')

  const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>({ pageSize: PAGE_SIZE })
  const [vendorFilter,  setVendorFilter]  = useState<VendorFilter>({ pageSize: PAGE_SIZE })

  const creatorQ = useKycCreatorQueue(creatorFilter)
  const vendorQ  = useKycVendorQueue(vendorFilter)

  const isCreator = tab === 'creator'
  const q         = isCreator ? creatorQ : vendorQ
  const items     = (q.data?.items ?? []) as Parameters<typeof KycQueueView>[0]['items']

  function setStateFilter(state: number | undefined) {
    if (isCreator) setCreatorFilter(f => ({ ...f, state: state as CreatorFilter['state'], cursor: undefined }))
    else           setVendorFilter(f  => ({ ...f, state: state as VendorFilter['state'],  cursor: undefined }))
  }

  function goNext() {
    const cursor = q.data?.nextCursor ?? undefined
    if (isCreator) setCreatorFilter(f => ({ ...f, cursor }))
    else           setVendorFilter(f  => ({ ...f, cursor }))
  }

  function goPrev() {
    const cursor = q.data?.previousCursor ?? undefined
    if (isCreator) setCreatorFilter(f => ({ ...f, cursor }))
    else           setVendorFilter(f  => ({ ...f, cursor }))
  }

  const stateFilter = isCreator ? creatorFilter.state : vendorFilter.state

  if (q.isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load KYC queue.
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {(['creator', 'vendor'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-[7px] text-[13px] font-semibold capitalize transition-all duration-[150ms] ${
              tab === t
                ? 'bg-primary/[0.15] text-primary border border-primary/30'
                : 'border border-white/[0.07] bg-white/[0.02] text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <KycQueueView
        kind={tab}
        items={items}
        totalCount={q.data?.totalCount ?? 0}
        stateFilter={stateFilter as number | undefined}
        isLoading={q.isLoading}
        hasNext={q.data?.hasMore ?? false}
        hasPrevious={!!q.data?.previousCursor}
        onNext={goNext}
        onPrev={goPrev}
        onStateFilter={setStateFilter}
      />
    </div>
  )
}
