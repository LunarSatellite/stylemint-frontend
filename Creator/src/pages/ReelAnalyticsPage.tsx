import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ReelDeepDive } from '@/features/analytics/ReelDeepDive'

export default function ReelAnalyticsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-64 rounded-xl bg-bg-card" />}>
        <ReelDeepDive />
      </Suspense>
    </ErrorBoundary>
  )
}
