import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { CreatorDeepDive } from '@/features/analytics/CreatorDeepDive'
import { asPartnershipId } from '@/lib/brands'

export default function CreatorAnalyticsPage() {
  const { pid } = useParams<{ pid: string }>()
  if (!pid) return null

  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <CreatorDeepDive partnershipId={asPartnershipId(pid)} />
    </ErrorBoundary>
  )
}
