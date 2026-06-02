import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StoryArcDetail } from '@/features/story-arcs/StoryArcDetail'

export default function StoryArcDetailPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-64 rounded-xl bg-bg-card" />}>
        <StoryArcDetail />
      </Suspense>
    </ErrorBoundary>
  )
}
