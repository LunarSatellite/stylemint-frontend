import { useSearchParams } from 'react-router-dom'
import { subDays, formatISO } from 'date-fns'
import { useAnalyticsReport } from '@/api/queries/useAnalyticsReport'

export function AnalyticsFullReport() {
  const [searchParams] = useSearchParams()
  const to   = new Date()
  const from = subDays(to, 30)
  const window = {
    fromUtc: searchParams.get('fromUtc') ?? formatISO(from),
    toUtc:   searchParams.get('toUtc')   ?? formatISO(to),
  }

  const { data, isLoading, isError, refetch } = useAnalyticsReport(window)

  if (isLoading) return <div className="animate-pulse h-64 rounded-xl bg-bg-card" />
  if (isError)   return <p className="text-text-muted">Failed to load report. <button onClick={() => void refetch()} className="text-primary underline">Retry</button></p>
  if (!data?.hasData) return <p className="text-text-muted">No data for this period.</p>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Full Analytics Report</h1>
    </div>
  )
}
