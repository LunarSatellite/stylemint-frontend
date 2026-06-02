import { useState } from 'react'
import { useProductAnalytics } from '@/api/queries/useProductAnalytics'
import type { ProductId } from '@/lib/brands'

interface ProductDeepDiveProps {
  productId: ProductId
}

export function ProductDeepDive({ productId }: ProductDeepDiveProps) {
  const [windowDays] = useState(30)
  const { data, isPending, isError } = useProductAnalytics(productId, { windowDays })

  if (isPending) return <div className="p-6 text-[var(--text-muted)] animate-pulse">Loading…</div>
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Product analytics failed to load.</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">
        {data.header?.productName ?? 'Product Analytics'}
      </h1>
      {/* TODO: KPI tiles, RevenueTrendChart, TopCreatorsTable, LocationBuckets, ReviewSummary */}
    </div>
  )
}
