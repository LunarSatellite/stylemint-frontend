import { useState } from 'react'
import { User, Store, FlaskConical, AlertTriangle } from 'lucide-react'
import { useKycCreatorQueue, useKycVendorQueue } from '@/api/queries/useKycQueue'
import { KycQueueView } from './KycQueueView'
import { KycReviewQueueView } from './KycReviewQueueView'
import { KYC_REVIEW_SEED } from './_seed/kycReviewSeed'
import { KYC_REVIEW_SEED_B } from './_seed/kycReviewSeedB'
import type { KycCreatorQueueFilter, KycVendorQueueFilter, CreatorApplicationDto, VendorApplicationDto } from '@/api/schema'

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

  const creatorItems: CreatorApplicationDto[] = creatorQ.data?.items ?? []
  const vendorItems:  VendorApplicationDto[] = vendorQ.data?.items ?? []

  function setStateFilter(state: number | undefined) {
    if (isCreator) setCreatorFilter(f => ({ ...f, state: state as CreatorFilter['state'], cursor: undefined }))
    else           setVendorFilter(f  => ({ ...f, state: state as VendorFilter['state'],  cursor: undefined }))
  }

  function goNext() {
    if (isCreator) {
      const cursor = creatorQ.data?.nextCursor ?? undefined
      setCreatorFilter(f => ({ ...f, cursor }))
    } else {
      const cursor = vendorQ.data?.nextCursor ?? undefined
      setVendorFilter(f  => ({ ...f, cursor }))
    }
  }

  function goPrev() {
    // PagedResult only has nextCursor (no previousCursor) — prev not supported
    if (isCreator) setCreatorFilter(f => ({ ...f, cursor: undefined }))
    else           setVendorFilter(f  => ({ ...f, cursor: undefined }))
  }

  const stateFilter = isCreator ? creatorFilter.state : vendorFilter.state

  const activeQ = isCreator ? creatorQ : vendorQ
  // Show error banner only when there's an error AND we have items (so user can still see stale data)
  if (!isDevTab && activeQ.isError && !activeQ.isLoading && activeQ.data?.items?.length) return (
    <div className="flex items-center gap-2.5 rounded-[12px] border border-red-400/20 bg-red-400/[0.08] px-4 py-[14px] text-[13px] text-red-400">
      <AlertTriangle size={15} className="shrink-0" />
      Failed to load KYC queue.
    </div>
  )

  const TAB_ICON = { creator: User, vendor: Store } as const

  return (
    <div className="flex flex-col gap-5">

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex items-center gap-1 rounded-[12px] border p-1"
          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-1)' }}
        >
          {(['creator', 'vendor'] as const).map(t => {
            const Icon = TAB_ICON[t]
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-[7px] rounded-[9px] px-4 py-[8px] text-[13px] font-semibold capitalize transition-all duration-[150ms] ${
                  active
                    ? 'bg-primary/[0.14] text-primary shadow-[0_0_0_1px_var(--border-primary)]'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon size={14} />
                {t}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-white/[0.08]" />

        {/* DEV tabs */}
        <div className="inline-flex items-center gap-1 rounded-[12px] border border-yellow-400/[0.15] bg-yellow-400/[0.03] p-1">
          {(['reviewA', 'reviewB'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-[7px] rounded-[9px] px-[14px] py-[8px] text-[13px] font-semibold transition-all duration-[150ms] ${
                tab === t
                  ? 'bg-yellow-400/[0.14] text-yellow-400 shadow-[0_0_0_1px_rgba(251,191,36,0.3)]'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <FlaskConical size={13} />
              {t === 'reviewA' ? 'Scenario A' : 'Scenario B'}
              <span className="rounded-[4px] bg-yellow-400/20 px-[6px] py-[1px] text-[9px] font-bold uppercase tracking-wider text-yellow-400">
                dev
              </span>
            </button>
          ))}
        </div>
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
          items={isCreator ? creatorItems : vendorItems}
          totalCount={isCreator ? creatorQ.data?.totalCount ?? 0 : vendorQ.data?.totalCount ?? 0}
          stateFilter={stateFilter as number | undefined}
          isLoading={isCreator ? creatorQ.isLoading : vendorQ.isLoading}
          hasNext={!!(isCreator ? creatorQ.data?.nextCursor : vendorQ.data?.nextCursor)}
          hasPrevious={false}
          onNext={goNext}
          onPrev={goPrev}
          onStateFilter={setStateFilter}
        />
      )}
    </div>
  )
}
