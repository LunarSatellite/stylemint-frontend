import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AnalyticsFullReport } from '@/features/analytics/AnalyticsFullReport'

export default function AnalyticsReportPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-64 rounded-xl bg-bg-card" />}>
        <AnalyticsFullReport />
      </Suspense>
    </ErrorBoundary>
  )
}
