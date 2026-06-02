import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StoryArcList } from '@/features/story-arcs/StoryArcList'

export default function StoryArcsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-64 rounded-xl bg-bg-card" />}>
        <StoryArcList />
      </Suspense>
    </ErrorBoundary>
  )
}
