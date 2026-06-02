import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AnalyticsDashboard } from '@/features/analytics/AnalyticsDashboard'

export default function AnalyticsDashboardPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <AnalyticsDashboard />
      </Suspense>
    </ErrorBoundary>
  )
}

function PageSkeleton() {
  return <div className="animate-pulse space-y-4"><div className="h-32 rounded-xl bg-bg-card" /><div className="h-64 rounded-xl bg-bg-card" /></div>
}
