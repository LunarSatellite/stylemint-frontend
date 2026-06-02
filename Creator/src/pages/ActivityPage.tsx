import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ActivityTimeline } from '@/features/activity/ActivityTimeline'

export default function ActivityPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-64 rounded-xl bg-bg-card" />}>
        <ActivityTimeline />
      </Suspense>
    </ErrorBoundary>
  )
}
