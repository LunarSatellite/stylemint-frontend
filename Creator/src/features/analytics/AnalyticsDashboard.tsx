import { useSearchParams } from 'react-router-dom'
import { subDays, formatISO } from 'date-fns'
import { useAnalyticsDashboard } from '@/api/queries/useAnalyticsDashboard'

function defaultWindow() {
  const to   = new Date()
  const from = subDays(to, 30)
  return { fromUtc: formatISO(from), toUtc: formatISO(to) }
}

export function AnalyticsDashboard() {
  const [searchParams] = useSearchParams()
  const window = {
    fromUtc: searchParams.get('fromUtc') ?? defaultWindow().fromUtc,
    toUtc:   searchParams.get('toUtc')   ?? defaultWindow().toUtc,
  }

  const { data, isLoading, isError, refetch } = useAnalyticsDashboard(window)

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-32 rounded-xl bg-bg-card" /><div className="h-64 rounded-xl bg-bg-card" /></div>
  if (isError)   return <p className="text-text-muted">Failed to load analytics. <button onClick={() => void refetch()} className="text-primary underline">Retry</button></p>
  if (!data?.hasData) return <p className="text-text-muted">No analytics data for this period yet.</p>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Analytics</h1>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Total Earnings" value={data.totalEarningsFormatted} />
        <MetricCard label="Total Views"    value={data.totalViews.toLocaleString()} />
        <MetricCard label="Avg Conversion" value={`${(data.avgConversionRate * 100).toFixed(1)}%`} />
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-text-primary">{value}</p>
    </div>
  )
}
