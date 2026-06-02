import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { AnalyticsRoot } from '@/features/analytics/AnalyticsRoot'

export default function AnalyticsPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <AnalyticsRoot />
    </ErrorBoundary>
  )
}
