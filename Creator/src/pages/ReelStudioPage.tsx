import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ReelStudio } from '@/features/reel-studio/ReelStudio'

export default function ReelStudioPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-full rounded-xl bg-bg-card" />}>
        <ReelStudio />
      </Suspense>
    </ErrorBoundary>
  )
}
