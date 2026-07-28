import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useModerationQueue } from '@/api/queries/useModerationQueue'
import type { ModerationQueueFilter } from '@/api/schema'
import { ModerationQueueView } from './ModerationQueueView'
import { ModerationSeedView } from './_seed/ModerationSeedView'
import { MODERATION_SEED } from './_seed/moderationSeed'

const PAGE_SIZE = 20

type Tab = 'live' | 'seed'

export function ModerationQueueContainer() {
  const [tab, setTab] = useState<Tab>('live')

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
    <div className="flex flex-col gap-5">

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setTab('live')}
          className={`flex items-center gap-[7px] rounded-[9px] px-4 py-[8px] text-[13px] font-semibold capitalize transition-all duration-[150ms] ${
            tab === 'live'
              ? 'bg-primary/[0.14] text-primary shadow-[0_0_0_1px_var(--border-primary)]'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Live Data
        </button>

        {/* DEV tab */}
        <div className="inline-flex items-center gap-1 rounded-[12px] border border-yellow-400/[0.15] bg-yellow-400/[0.03] p-1">
          <button
            onClick={() => setTab('seed')}
            className={`flex items-center gap-[7px] rounded-[9px] px-[14px] py-[8px] text-[13px] font-semibold transition-all duration-[150ms] ${
              tab === 'seed'
                ? 'bg-yellow-400/[0.14] text-yellow-400 shadow-[0_0_0_1px_rgba(251,191,36,0.3)]'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <FlaskConical size={13} />
            Seed Data
            <span className="rounded-[4px] bg-yellow-400/20 px-[6px] py-[1px] text-[9px] font-bold uppercase tracking-wider text-yellow-400">
              dev
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'seed' && <ModerationSeedView items={MODERATION_SEED} />}
      {tab === 'live' && (
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
      )}
    </div>
  )
}
