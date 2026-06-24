import { useState } from 'react'
import { useKycCreatorQueue, useKycVendorQueue } from '@/api/queries/useKycQueue'
import { KycQueueView } from './KycQueueView'
import { KycReviewQueueView } from './KycReviewQueueView'
import { KYC_REVIEW_SEED } from './_seed/kycReviewSeed'
import { KYC_REVIEW_SEED_B } from './_seed/kycReviewSeedB'
import type { KycCreatorQueueFilter, KycVendorQueueFilter } from '@/api/schema'

type CreatorFilter = KycCreatorQueueFilter
type VendorFilter  = KycVendorQueueFilter

type Tab = 'creator' | 'vendor' | 'reviewA' | 'reviewB'

const PAGE_SIZE = 25

export function KycQueueContainer() {
  const [tab, setTab] = useState<Tab>('creator')

  const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>({ pageSize: PAGE_SIZE })
  const [vendorFilter,  setVendorFilter]  = useState<VendorFilter>({ pageSize: PAGE_SIZE })

  const creatorQ = useKycCreatorQueue(creatorFilter)
  const vendorQ  = useKycVendorQueue(vendorFilter)

  const isDevTab  = tab === 'reviewA' || tab === 'reviewB'
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

  if (!isDevTab && q.isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load KYC queue.
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['creator', 'vendor'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-[7px] text-[13px] font-semibold capitalize transition-all duration-[150ms] ${
              tab === t
                ? 'border border-primary/30 bg-primary/[0.15] text-primary'
                : 'border border-white/[0.07] bg-white/[0.02] text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}

        {/* Divider */}
        <div className="h-5 w-px bg-white/[0.08]" />

        {/* DEV tabs */}
        {(['reviewA', 'reviewB'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-lg px-4 py-[7px] text-[13px] font-semibold transition-all duration-[150ms] ${
              tab === t
                ? 'border border-yellow-400/30 bg-yellow-400/[0.12] text-yellow-400'
                : 'border border-white/[0.07] bg-white/[0.02] text-text-muted hover:text-text-secondary'
            }`}
          >
            {t === 'reviewA' ? 'Scenario A' : 'Scenario B'}
            <span className="rounded-[4px] bg-yellow-400/20 px-[6px] py-[1px] text-[9px] font-bold uppercase tracking-wider text-yellow-400">
              dev
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'reviewA' && (
        <KycReviewQueueView scenario="A" items={KYC_REVIEW_SEED} />
      )}
      {tab === 'reviewB' && (
        <KycReviewQueueView scenario="B" items={KYC_REVIEW_SEED_B} />
      )}
      {!isDevTab && (
        <KycQueueView
          kind={tab as 'creator' | 'vendor'}
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
      )}
    </div>
  )
}
