import { useAnalyticsOverview } from '@/api/queries/useAnalyticsOverview'
import { formatPercent } from '@/lib/formatters'

interface AnalyticsOverviewProps {
  window: { fromUtc: string; toUtc: string }
}

export function AnalyticsOverview({ window }: AnalyticsOverviewProps) {
  const { data, isLoading } = useAnalyticsOverview(window)

  if (isLoading) return <div className="animate-pulse grid grid-cols-4 gap-3"><div className="h-20 rounded-xl bg-bg-card col-span-4" /></div>
  if (!data) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricTile label="Earnings"    value={data.totalEarningsFormatted} />
      <MetricTile label="Views"       value={data.totalViews.toLocaleString()} />
      <MetricTile label="Conversion"  value={formatPercent(data.avgConversionRate)} />
      <MetricTile label="New Followers" value={data.followersGained.toLocaleString()} />
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text-primary">{value}</p>
    </div>
  )
}
