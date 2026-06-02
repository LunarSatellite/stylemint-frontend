import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { ActivityRoot } from '@/features/activity/ActivityRoot'

export default function ActivityPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <ActivityRoot />
    </ErrorBoundary>
  )
}
