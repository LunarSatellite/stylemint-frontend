import { useState } from 'react'
import { useAnalyticsOverview } from '@/api/queries/useAnalyticsOverview'

const WINDOWS = [7, 30, 90, 365]

export function AnalyticsRoot() {
  const [windowDays, setWindowDays] = useState(30)
  const { data, isPending, isError } = useAnalyticsOverview({ windowDays })

  if (isPending) return <AnalyticsSkeleton />
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Analytics failed to load.</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Analytics</h1>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindowDays(w)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                windowDays === w
                  ? 'bg-[var(--primary)] text-[var(--bg-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* TODO: RevenueTrendChart (ECharts Canvas) */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Gross Sales</p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">
            {data.grossSales.current.amount.toLocaleString()} {data.grossSales.current.currency}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Conversion Rate</p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">
            {(data.conversionRate.current * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Total Orders</p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">{data.totalOrders.current}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Net Revenue</p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">
            {data.netRevenue.current.amount.toLocaleString()} {data.netRevenue.current.currency}
          </p>
        </div>
      </div>

      {/* TODO: RevenueTrendChart, TopProductsTable, TopCreatorsTable, TrafficSourceChart */}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading analytics">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-2)]" />
    </div>
  )
}
