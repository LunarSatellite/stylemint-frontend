import { useState } from 'react'
import { useCreatorAnalytics } from '@/api/queries/useCreatorAnalytics'
import type { PartnershipId } from '@/lib/brands'

interface CreatorDeepDiveProps {
  partnershipId: PartnershipId
}

export function CreatorDeepDive({ partnershipId }: CreatorDeepDiveProps) {
  const [windowDays] = useState(30)
  const { data, isPending, isError } = useCreatorAnalytics(partnershipId, { windowDays })

  if (isPending) return <div className="p-6 text-[var(--text-muted)] animate-pulse">Loading…</div>
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Creator analytics failed to load.</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">
        {data.header?.creatorHandle ?? 'Creator Analytics'}
      </h1>
      {/* TODO: KPI tiles, RevenueTrendChart, TopProductsTable, TopReels */}
    </div>
  )
}
