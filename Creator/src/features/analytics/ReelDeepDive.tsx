import { useParams, useSearchParams } from 'react-router-dom'
import { subDays, formatISO } from 'date-fns'
import { useReelAnalytics } from '@/api/queries/useReelAnalytics'
import { formatPercent } from '@/lib/formatters'

export function ReelDeepDive() {
  const { reelId } = useParams<{ reelId: string }>()
  const [searchParams] = useSearchParams()
  const to   = new Date()
  const from = subDays(to, 30)
  const window = {
    fromUtc: searchParams.get('fromUtc') ?? formatISO(from),
    toUtc:   searchParams.get('toUtc')   ?? formatISO(to),
  }

  const { data, isLoading, isError, refetch } = useReelAnalytics(reelId!, window)

  if (isLoading) return <div className="animate-pulse h-64 rounded-xl bg-bg-card" />
  if (isError)   return <p className="text-text-muted">Failed to load. <button onClick={() => void refetch()} className="text-primary underline">Retry</button></p>
  if (!data?.hasData) return <p className="text-text-muted">No data yet for this reel.</p>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Reel Analytics</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-bg-card p-4">
          <p className="text-xs text-text-muted">Views</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{data.views.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-bg-card p-4">
          <p className="text-xs text-text-muted">Conversion</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{formatPercent(data.conversionRate)}</p>
        </div>
        <div className="rounded-xl bg-bg-card p-4">
          <p className="text-xs text-text-muted">Earnings</p>
          <p className="mt-1 text-xl font-bold text-primary">{data.earningsFormatted}</p>
        </div>
      </div>
    </div>
  )
}
