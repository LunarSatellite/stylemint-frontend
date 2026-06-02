import { useParams } from 'react-router-dom'
import { usePostPublishReport } from '@/api/queries/usePostPublishReport'
import { MoneyDisplay } from '@/components/MoneyDisplay'

export function PostPublishReport() {
  const { reelId } = useParams<{ reelId: string }>()
  const { data, isLoading, isError, refetch } = usePostPublishReport(reelId!)

  if (isLoading) return <div className="animate-pulse h-64 rounded-xl bg-bg-card" />
  if (isError)   return <p className="text-text-muted">Failed to load report. <button onClick={() => void refetch()} className="text-primary underline">Retry</button></p>
  if (!data)     return null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Post-Publish Report</h1>
      <MoneyDisplay formatted={data.commissionEarnedFormatted} className="text-2xl font-bold text-primary" />
    </div>
  )
}
